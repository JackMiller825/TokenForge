import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { LIMITS } from '../config';
import { CancelledError } from '../browser/cancel';
import { isUnsafeInteraction } from '../discover/interact';
import { assertPublicUrl, isObviouslyBlocked } from '../security/network';
import { startEgressProxy } from '../security/proxy';
import { isTracker } from '../discover/trackers';
import type { Progress } from '../types';
import { interpretProbe } from './interpret';
import { VIEWPORTS, type AnalysisResult, type ManifestRef, type MotionRecord, type RawProbe, type ResponsiveNote, type ScreenshotRecord, type ViewportPreset } from './model';
import { probePage } from './probe';

export interface AnalyzeOptions {
  url: string;
  projectId: string;
  projectDir: string;
  manifest?: ManifestRef[];
  signal?: AbortSignal;
  testAllowHosts?: string[];
  settleMs?: number;
  onProgress?: (progress: Progress) => void;
}

const STAGES = [
  ['initializing', 'Initializing'],
  ['rendering-desktop', 'Rendering desktop'],
  ['discovering-sections', 'Discovering sections'],
  ['mapping-assets', 'Mapping assets'],
  ['extracting-tokens', 'Extracting design tokens'],
  ['inspecting-interactions', 'Inspecting interactions'],
  ['rendering-responsive', 'Rendering tablet and mobile'],
  ['generating-screenshots', 'Generating screenshots'],
  ['validating', 'Validating blueprint'],
  ['done', 'Completed'],
] as const;

let activeBrowsers = 0;
export function browserCount(): number {
  return activeBrowsers;
}

function log(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: 'tokenforge', event, ...fields }));
}

function throwIfCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new CancelledError();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'section';
}

async function settle(page: Page, ms: number, signal?: AbortSignal) {
  throwIfCancelled(signal);
  await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
  await page.waitForTimeout(ms).catch(() => undefined);
}

async function capture(page: Page, file: string, full: boolean, maxHeight: number): Promise<{ partial: boolean; note?: string }> {
  const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
  if (!full || height <= maxHeight) {
    await page.screenshot({ path: file, fullPage: full });
    return { partial: false };
  }
  await page.evaluate((max) => {
    document.documentElement.style.maxHeight = `${max}px`;
    document.documentElement.style.overflow = 'hidden';
  }, maxHeight);
  await page.screenshot({ path: file, fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.maxHeight = '';
    document.documentElement.style.overflow = '';
  });
  return { partial: true, note: `Page is ${height}px tall. Capture kept the first ${maxHeight}px.` };
}

export async function analyzeSite(options: AnalyzeOptions): Promise<AnalysisResult> {
  const started = Date.now();
  const analyzedAt = new Date(started).toISOString();
  const warnings: string[] = [];
  const settleMs = options.settleMs ?? LIMITS.analysisSettleMs;
  let stage = 0;
  const report = (message?: string, counts?: { assets?: number; sections?: number }) => {
    const [phase, label] = STAGES[stage] || STAGES[STAGES.length - 1];
    options.onProgress?.({
      phase,
      message: message || label,
      pagesScanned: 1,
      pagesQueued: 0,
      assetsFound: counts?.assets ?? 0,
      completed: stage,
      failed: 0,
      total: STAGES.length - 1,
      bytes: 0,
      elapsedMs: Date.now() - started,
      stage,
      stageTotal: STAGES.length - 1,
    });
  };
  const mark = (index: number, message?: string, counts?: { assets?: number; sections?: number }) => {
    stage = index;
    report(message, counts);
  };

  const start = await assertPublicUrl(options.url, { testAllowHosts: options.testAllowHosts });
  throwIfCancelled(options.signal);
  report('Initializing the browser');
  if (activeBrowsers >= LIMITS.maxBrowsers) warnings.push('Another browser task is still closing. This analysis waited for it.');
  const proxy = await startEgressProxy({ testAllowHosts: options.testAllowHosts });
  activeBrowsers += 1;
  const browser = await chromium.launch({
    headless: true,
    proxy: { server: proxy.url },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  }).catch((error: unknown) => {
    activeBrowsers = Math.max(0, activeBrowsers - 1);
    void proxy.close();
    const message = error instanceof Error ? error.message : 'Chromium failed to launch';
    if (/executable|browserType|chromium/i.test(message)) throw new Error('Chromium is not installed. Run npx playwright install chromium');
    throw error;
  });
  log('analyze.start', { projectId: options.projectId, url: start.href });

  try {
    throwIfCancelled(options.signal);
    const context = await browser.newContext({
      viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height },
      deviceScaleFactor: 1,
      serviceWorkers: 'block',
      acceptDownloads: false,
      locale: 'en-US',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    await page.route('**/*', async (route) => {
      const target = route.request().url();
      try {
        if (isTracker(target) || isObviouslyBlocked(target, { testAllowHosts: options.testAllowHosts })) {
          await route.abort('blockedbyclient');
          return;
        }
        await assertPublicUrl(target, { testAllowHosts: options.testAllowHosts });
        await route.continue();
      } catch {
        await route.abort('blockedbyclient').catch(() => undefined);
      }
    });
    mark(1, 'Rendering the desktop page');
    try {
      await page.goto(start.href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'navigation failed';
      throw new Error(`Could not open the page: ${message}`);
    }
    await settle(page, settleMs, options.signal);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => undefined);
    await page.waitForTimeout(250).catch(() => undefined);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
    await settle(page, Math.min(settleMs, 300), options.signal);

    mark(2, 'Discovering sections');
    const desktop = await page.evaluate(probePage) as RawProbe;
    const blocked = desktop.assets.filter((asset) => isObviouslyBlocked(asset.url, { testAllowHosts: options.testAllowHosts }));
    desktop.assets = desktop.assets.filter((asset) => !isObviouslyBlocked(asset.url, { testAllowHosts: options.testAllowHosts }));
    if (blocked.length) warnings.push(`Ignored ${blocked.length} asset references on private or unsupported addresses.`);
    const interpreted = interpretProbe(desktop, options.manifest || [], 'desktop');
    warnings.push(...interpreted.warnings);
    mark(3, 'Mapping assets', { assets: interpreted.assetMap.length, sections: interpreted.sections.length });
    mark(4, 'Extracting design tokens');
    mark(5, 'Inspecting safe interactions');
    const hovers = await inspectHovers(page, options.signal);
    interpreted.interactions.push(...hovers);

    const screenshots: ScreenshotRecord[] = [];
    const shotDir = join(options.projectDir, 'screenshots');
    await mkdir(join(shotDir, 'desktop'), { recursive: true });
    mark(6, 'Generating screenshots');
    const viewportFile = 'screenshots/desktop/viewport.png';
    await page.screenshot({ path: join(options.projectDir, viewportFile) });
    screenshots.push({ id: 'desktop-viewport', viewport: 'desktop', kind: 'viewport', file: viewportFile, width: VIEWPORTS[0].width, height: VIEWPORTS[0].height, deviceScaleFactor: 1, partial: false });
    const fullFile = 'screenshots/desktop/full-page.png';
    const full = await capture(page, join(options.projectDir, fullFile), true, LIMITS.maxFullPageHeight);
    screenshots.push({ id: 'desktop-full', viewport: 'desktop', kind: 'full-page', file: fullFile, width: desktop.scrollWidth, height: Math.min(desktop.scrollHeight, LIMITS.maxFullPageHeight), deviceScaleFactor: 1, partial: full.partial, note: full.note });
    if (full.note) warnings.push(full.note);
    let shot = 0;
    for (const section of interpreted.sections) {
      if (shot >= LIMITS.maxSectionShots || section.height < 40) continue;
      shot += 1;
      const name = `screenshots/desktop/section-${String(shot).padStart(2, '0')}-${slug(section.role)}.png`;
      const locator = page.locator(section.selector).first();
      const made = await locator.screenshot({ path: join(options.projectDir, name), timeout: 4000 }).then(() => true).catch(async () => {
        const fallback = page.locator(section.alternateSelector).first();
        return fallback.screenshot({ path: join(options.projectDir, name), timeout: 4000 }).then(() => true).catch(() => false);
      });
      if (!made) {
        warnings.push(`Section screenshot failed for ${section.name}. The selector may have changed after load.`);
        continue;
      }
      screenshots.push({
        id: `desktop-${section.id}`,
        viewport: 'desktop',
        kind: 'section',
        sectionId: section.id,
        file: name,
        width: section.width,
        height: section.height,
        deviceScaleFactor: 1,
        partial: section.height > VIEWPORTS[0].height,
        note: section.roleInferred ? 'Section role is inferred.' : undefined,
      });
    }

    mark(7, 'Rendering tablet and mobile');
    const responsive: ResponsiveNote[] = [noteFor('desktop', VIEWPORTS[0], desktop, interpreted.sections.length)];
    for (const preset of VIEWPORTS.slice(1)) {
      throwIfCancelled(options.signal);
      await page.setViewportSize({ width: preset.width, height: preset.height });
      await settle(page, settleMs, options.signal);
      const probe = await page.evaluate(probePage) as RawProbe;
      const local = interpretProbe(probe, options.manifest || [], preset.id);
      responsive.push(noteFor(preset.id, preset, probe, local.sections.length, interpreted.sections.length));
      await mkdir(join(shotDir, preset.id), { recursive: true });
      const file = `screenshots/${preset.id}/full-page.png`;
      const shotResult = await capture(page, join(options.projectDir, file), true, LIMITS.maxFullPageHeight);
      screenshots.push({ id: `${preset.id}-full`, viewport: preset.id, kind: 'full-page', file, width: probe.scrollWidth, height: Math.min(probe.scrollHeight, LIMITS.maxFullPageHeight), deviceScaleFactor: preset.deviceScaleFactor, partial: shotResult.partial, note: shotResult.note });
      if (shotResult.note) warnings.push(`${preset.id}: ${shotResult.note}`);
    }

    mark(8, 'Validating the blueprint');
    if (!screenshots.some((item) => item.viewport === 'desktop' && item.kind === 'full-page')) {
      throw new Error('Desktop full-page screenshot is missing');
    }
    for (const id of ['tablet', 'mobile']) {
      if (!screenshots.some((item) => item.viewport === id && item.kind === 'full-page')) warnings.push(`${id} full-page screenshot is missing.`);
    }
    const finalUrl = page.url() || desktop.url;
    await context.close().catch(() => undefined);
    stage = STAGES.length - 1;
    report('Completed', { assets: interpreted.assetMap.length, sections: interpreted.sections.length });
    const result: AnalysisResult = {
      schemaVersion: '2.0.0',
      projectId: options.projectId,
      url: options.url,
      finalUrl,
      title: desktop.title || 'Untitled site',
      analyzedAt,
      completedAt: new Date().toISOString(),
      demo: false,
      warnings,
      pages: [{ url: desktop.url, title: desktop.title }],
      screenshots,
      sections: interpreted.sections,
      designSystem: interpreted.designSystem,
      assetMap: interpreted.assetMap,
      animations: interpreted.animations,
      interactions: interpreted.interactions,
      responsive,
      manifestAssetIds: (options.manifest || []).map((asset) => asset.id),
    };
    log('analyze.done', { projectId: options.projectId, sections: result.sections.length, assets: result.assetMap.length, elapsedMs: Date.now() - started });
    return result;
  } finally {
    await browser.close().catch(() => undefined);
    await proxy.close().catch(() => undefined);
    activeBrowsers = Math.max(0, activeBrowsers - 1);
  }
}

function noteFor(id: string, preset: ViewportPreset, probe: RawProbe, sectionCount: number, desktopCount?: number): ResponsiveNote {
  const notes: string[] = [];
  if (probe.scrollWidth > preset.width + 8) notes.push('Horizontal overflow is visible at this width.');
  if (desktopCount != null && sectionCount !== desktopCount) notes.push(`Section count changed from ${desktopCount} on desktop to ${sectionCount}.`);
  return {
    viewport: id,
    width: preset.width,
    height: preset.height,
    deviceScaleFactor: preset.deviceScaleFactor,
    sectionCount,
    scrollWidth: probe.scrollWidth,
    scrollHeight: probe.scrollHeight,
    overflow: probe.scrollWidth > preset.width + 8,
    notes,
  };
}

async function inspectHovers(page: Page, signal?: AbortSignal): Promise<MotionRecord[]> {
  const found: MotionRecord[] = [];
  const handles = await page.locator('a, button, [role="button"]').all();
  let probes = 0;
  for (const handle of handles) {
    throwIfCancelled(signal);
    if (probes >= 6 || found.length >= 6) break;
    const text = (await handle.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 80);
    const type = await handle.getAttribute('type').catch(() => null);
    const insideForm = await handle.evaluate((element) => Boolean(element.closest('form'))).catch(() => true);
    if (isUnsafeInteraction(text, type, insideForm)) continue;
    const box = await handle.boundingBox().catch(() => null);
    if (!box) continue;
    probes += 1;
    const read = () => handle.evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.backgroundColor}|${style.color}|${style.transform}|${style.opacity}`;
    });
    const before = await read().catch(() => '');
    await handle.hover({ timeout: 1000 }).catch(() => undefined);
    await page.waitForTimeout(180).catch(() => undefined);
    const after = await read().catch(() => '');
    if (!before || before === after) continue;
    const selector = await handle.evaluate((element) => element.id ? `#${CSS.escape(element.id)}` : element.tagName.toLowerCase()).catch(() => 'button');
    found.push({
      id: `hover-${probes}`,
      kind: 'hover',
      trigger: 'hover',
      properties: ['background', 'color', 'transform', 'opacity'],
      start: before,
      end: after,
      selector,
      sectionId: null,
      confidence: 0.7,
      limitation: 'Measured by hovering a safe control. The original stylesheet rule was not copied.',
    });
  }
  return found;
}

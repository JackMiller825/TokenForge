import { chromium, type Page } from 'playwright';
import { LIMITS, MODE_DEFAULTS } from '../config';
import { categoryCounts } from '../types';
import type { Progress, ScanInput, ScanResult, StoredCookie } from '../types';
import { AssetCollector } from '../discover/collect';
import { extractCssRefs } from '../discover/css';
import { extractFromHtml } from '../discover/dom';
import { isUnsafeInteraction } from '../discover/interact';
import { isDisallowed, parseRobots } from '../discover/robots';
import { isTracker } from '../discover/trackers';
import { canonicalUrl, resolveUrl, shouldCrawl } from '../discover/urls';
import { extensionOfUrl } from '../security/filename';
import { safeFetch } from '../security/fetch';
import { assertPublicUrl, isObviouslyBlocked } from '../security/network';
import { startEgressProxy } from '../security/proxy';
import { CancelledError } from './cancel';

export interface ScanHooks {
  signal?: AbortSignal;
  onProgress?: (progress: Progress) => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

async function scrollPage(page: Page, steps: number, signal?: AbortSignal) {
  for (let step = 0; step < steps; step += 1) {
    if (signal?.aborted) throw new CancelledError();
    await page.evaluate(() => window.scrollBy(0, Math.max(window.innerHeight || 800, 700))).catch(() => undefined);
    await sleep(320);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined);
}

async function interact(page: Page, budget: { left: number }) {
  const handles = await page.locator('button, [role="button"], summary, [role="tab"]').all();
  for (const handle of handles) {
    if (budget.left <= 0) return;
    const text = (await handle.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 140);
    const type = await handle.getAttribute('type').catch(() => null);
    const insideForm = await handle.evaluate((element) => Boolean(element.closest('form'))).catch(() => true);
    if (!text || isUnsafeInteraction(text, type, insideForm)) continue;
    const box = await handle.boundingBox().catch(() => null);
    if (!box || box.width < 2 || box.height < 2) continue;
    const before = page.url();
    budget.left -= 1;
    await handle.click({ timeout: 1500 }).catch(() => undefined);
    await sleep(400);
    if (page.url() !== before) await page.goto(before, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => undefined);
  }
}

export async function scanSite(input: ScanInput, hooks: ScanHooks = {}): Promise<{ result: ScanResult; cookies: StoredCookie[] }> {
  const started = new Date();
  const modeDefaults = MODE_DEFAULTS[input.mode];
  const maxPages = input.mode === 'quick' ? 1 : clamp(input.maxPages || modeDefaults.maxPages, 1, LIMITS.maxPagesCap);
  const maxDepth = input.mode === 'quick' ? 0 : clamp(input.maxDepth ?? modeDefaults.maxDepth, 0, LIMITS.maxDepthCap);
  const deadline = Date.now() + modeDefaults.budgetMs;
  const warnings: string[] = [];
  const collector = new AssetCollector({ includeTrackers: input.includeTrackers, testAllowHosts: input.testAllowHosts });
  const stylesheets = new Set<string>();
  const start = await assertPublicUrl(input.url, { testAllowHosts: input.testAllowHosts });
  let rules: string[] = [];
  try {
    const robots = await safeFetch(new URL('/robots.txt', start).href, {
      timeoutMs: 8000,
      maxBytes: 200_000,
      testAllowHosts: input.testAllowHosts,
      signal: hooks.signal,
    });
    rules = parseRobots(robots.buffer.toString('utf8'));
    if (isDisallowed(start.pathname || '/', rules)) warnings.push('robots.txt disallows this path. The requested page is still scanned because you asked for it; linked pages that are disallowed are skipped.');
  } catch {
    // A missing robots.txt is not a scan failure.
  }

  const proxy = await startEgressProxy({ testAllowHosts: input.testAllowHosts });
  const browser = await chromium.launch({
    headless: true,
    proxy: { server: proxy.url },
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Chromium failed to launch';
    if (/executable|browserType|chromium/i.test(message)) throw new Error('Chromium is not installed. Run npx playwright install chromium');
    throw error;
  });

  const queue: Array<{ url: string; depth: number }> = [{ url: start.href, depth: 0 }];
  const seen = new Set<string>();
  const pages: string[] = [];
  let title = '';
  let finalUrl = start.href;
  const clicks = { left: modeDefaults.interactions };
  const report = (phase: Progress['phase'], message: string, currentUrl?: string) => {
    hooks.onProgress?.({
      phase,
      message,
      currentUrl,
      pagesScanned: pages.length,
      pagesQueued: queue.length,
      assetsFound: collector.list().length,
      completed: 0,
      failed: 0,
      total: 0,
      bytes: 0,
    });
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
      acceptDownloads: false,
      locale: 'en-US',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12_000);
    await page.route('**/*', async (route) => {
      const target = route.request().url();
      try {
        if (!input.includeTrackers && isTracker(target)) {
          await route.abort('blockedbyclient');
          return;
        }
        if (isObviouslyBlocked(target, { testAllowHosts: input.testAllowHosts })) {
          await route.abort('blockedbyclient');
          return;
        }
        await assertPublicUrl(target, { testAllowHosts: input.testAllowHosts });
        await route.continue();
      } catch {
        await route.abort('blockedbyclient').catch(() => undefined);
      }
    });
    page.on('response', (response) => {
      try {
        const url = response.url();
        if (isObviouslyBlocked(url, { testAllowHosts: input.testAllowHosts })) return;
        const headers = response.headers();
        const mime = headers['content-type'] || '';
        const length = Number(headers['content-length'] || 0) || undefined;
        collector.add(url, 'network', page.url() || finalUrl, mime, length);
        const path = url.split('?')[0]?.toLowerCase() || '';
        if (mime.includes('text/css') || path.endsWith('.css')) stylesheets.add(url);
      } catch {
        // Ignore responses that do not yield a usable URL.
      }
    });

    report('launching', 'Opening the browser');
    while (queue.length > 0 && pages.length < maxPages) {
      if (hooks.signal?.aborted) throw new CancelledError();
      if (Date.now() > deadline) {
        warnings.push('Scan stopped because it reached the time limit.');
        break;
      }
      const item = queue.shift()!;
      const canonical = canonicalUrl(item.url);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      report('loading', `Opening ${item.url}`, item.url);
      try {
        await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'navigation failed';
        warnings.push(`Could not open ${item.url}: ${message}`);
        if (!pages.length) throw new Error(`Could not open the page: ${message}`);
        continue;
      }
      if (!pages.length) {
        finalUrl = page.url();
        title = await page.title().catch(() => '');
      }
      pages.push(page.url());
      const scrolls = pages.length === 1 ? modeDefaults.scrolls : Math.min(2, modeDefaults.scrolls);
      report('crawling', `Reading ${page.url()}`, page.url());
      await scrollPage(page, scrolls, hooks.signal);
      if (clicks.left > 0) await interact(page, clicks);
      const html = await page.content();
      const current = page.url();
      const extracted = extractFromHtml(html, current);
      for (const ref of extracted.refs) collector.add(ref.url, ref.method, current);
      const computed = await page.evaluate(() => {
        const urls: string[] = [];
        const backgrounds: string[] = [];
        for (const image of Array.from(document.images)) {
          if (image.currentSrc) urls.push(image.currentSrc);
          const src = image.getAttribute('src');
          if (src) urls.push(image.src);
        }
        for (const media of Array.from(document.querySelectorAll('video, audio'))) {
          const element = media as HTMLMediaElement;
          if (element.currentSrc) urls.push(element.currentSrc);
          if (element instanceof HTMLVideoElement && element.poster) urls.push(element.poster);
        }
        let seenNodes = 0;
        for (const element of Array.from(document.querySelectorAll('body *'))) {
          if (seenNodes += 1, seenNodes > 2000) break;
          const value = getComputedStyle(element).backgroundImage;
          if (value && value.includes('url(')) backgrounds.push(value);
        }
        const links = Array.from(document.querySelectorAll('a[href]')).map((anchor) => (anchor as HTMLAnchorElement).href);
        return { urls, backgrounds, links };
      });
      for (const url of computed.urls) collector.add(url, 'dom', current);
      for (const background of computed.backgrounds) {
        for (const url of extractCssRefs(background, current)) collector.add(url, 'computed-style', current);
      }
      if (item.depth < maxDepth) {
        const origin = new URL(current).origin;
        for (const link of [...extracted.links, ...computed.links]) {
          const resolved = resolveUrl(link, current);
          if (!resolved || !shouldCrawl(resolved, origin)) continue;
          const path = new URL(resolved).pathname;
          if (isDisallowed(path, rules)) continue;
          const key = canonicalUrl(resolved);
          if (seen.has(key) || queue.some((entry) => canonicalUrl(entry.url) === key)) continue;
          if (seen.size + queue.length >= maxPages) continue;
          queue.push({ url: resolved, depth: item.depth + 1 });
        }
      }
      report('extracting', `Found ${collector.list().length} assets`, current);
    }

    const fetchedCss = new Set<string>();
    const ingestCss = async (url: string, depth: number): Promise<void> => {
      if (depth > 3 || fetchedCss.size >= LIMITS.maxStylesheets || fetchedCss.has(canonicalUrl(url))) return;
      fetchedCss.add(canonicalUrl(url));
      try {
        const file = await safeFetch(url, {
          maxBytes: LIMITS.cssMaxBytes,
          timeoutMs: 8000,
          testAllowHosts: input.testAllowHosts,
          signal: hooks.signal,
        });
        collector.add(file.finalUrl, 'css', finalUrl, file.contentType, file.buffer.length);
        for (const ref of extractCssRefs(file.buffer.toString('utf8'), file.finalUrl)) {
          collector.add(ref, 'css', file.finalUrl);
          if (extensionOfUrl(ref) === 'css') await ingestCss(ref, depth + 1);
        }
      } catch {
        // Stylesheets that cannot be fetched remain as references when the browser already saw them.
      }
    };
    for (const sheet of stylesheets) await ingestCss(sheet, 0);

    const cookies = (await context.cookies()).map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
    }));
    await context.close();
    if (collector.capped) warnings.push(`Discovery stopped after ${LIMITS.maxDiscovered} assets.`);
    if (collector.trackerSkips && !input.includeTrackers) warnings.push(`Skipped ${collector.trackerSkips} advertising or analytics requests.`);
    if (pages.length >= maxPages && queue.length) warnings.push(`Page limit reached (${maxPages}).`);
    const assets = collector.list();
    const result: ScanResult = {
      manifestVersion: '1.0.0',
      pageUrl: input.url,
      finalUrl,
      title: title || 'Untitled site',
      scannedAt: started.toISOString(),
      completedAt: new Date().toISOString(),
      mode: input.mode,
      pages,
      warnings,
      assets,
      stats: { discovered: assets.length, byCategory: categoryCounts(assets) },
    };
    report('finalizing', `Discovered ${assets.length} assets`);
    return { result, cookies };
  } finally {
    await browser.close().catch(() => undefined);
    await proxy.close().catch(() => undefined);
  }
}

import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { writeBlueprint } from '../src/lib/analyze/export';
import type { AnalysisResult } from '../src/lib/analyze/model';
import { ProjectStore } from '../src/lib/projects/store';
import { browserCount } from '../src/lib/analyze/engine';
import { CancelledError } from '../src/lib/browser/cancel';
import { analyzeSite } from '../src/lib/analyze/engine';

function analysis(projectId: string): AnalysisResult {
  return {
    schemaVersion: '2.0.0',
    projectId,
    url: 'https://example.com/',
    finalUrl: 'https://example.com/',
    title: 'Example',
    analyzedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.000Z',
    demo: false,
    warnings: [],
    pages: [{ url: 'https://example.com/', title: 'Example' }],
    screenshots: [{ id: 'full', viewport: 'desktop', kind: 'full-page', file: 'screenshots/desktop/full-page.png', width: 10, height: 10, deviceScaleFactor: 1, partial: false }],
    sections: [],
    designSystem: { declaredVariables: [], colors: [], gradients: [], fonts: [], radii: [], borders: [], shadows: [], containers: [], columns: [], spacing: [], breakpoints: [] },
    assetMap: [],
    animations: [],
    interactions: [],
    responsive: [],
    manifestAssetIds: [],
  };
}

describe('project persistence', () => {
  it('renames, versions, and deletes a project without putting screenshots in the index', () => {
    const root = mkdtempSync(join(tmpdir(), 'tf-projects-'));
    const store = new ProjectStore(root, 'json');
    const created = store.create({ name: 'Whale', url: 'https://example.com/' });
    store.saveAnalysis(created.id, analysis(created.id), 'first');
    store.saveAnalysis(created.id, analysis(created.id), 'second');
    const renamed = store.update(created.id, { name: 'Whale v2' });
    expect(renamed.name).toBe('Whale v2');
    expect(store.get(created.id)?.versions).toHaveLength(2);
    expect(store.readAnalysis(created.id)?.title).toBe('Example');
    store.remove(created.id);
    expect(store.get(created.id)).toBeNull();
  });
});

describe('blueprint archive', () => {
  it('writes the schema files and the screenshot', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tf-blueprint-'));
    const projectId = '11111111-1111-4111-8111-111111111111';
    const projectDir = join(root, 'project');
    mkdirSync(join(projectDir, 'screenshots', 'desktop'), { recursive: true });
    writeFileSync(join(projectDir, 'screenshots', 'desktop', 'full-page.png'), Buffer.from('png'));
    const zipPath = join(root, 'reference-blueprint.zip');
    const outcome = await writeBlueprint(zipPath, projectDir, analysis(projectId));
    expect(outcome.errors).toEqual([]);
    const zip = await JSZip.loadAsync(await import('node:fs/promises').then((fs) => fs.readFile(zipPath)));
    for (const name of ['README.md', 'manifest.json', 'assets/index.json', 'analysis/pages.json', 'analysis/sections.json', 'analysis/design-system.json', 'analysis/asset-map.json', 'analysis/animations.json', 'analysis/interactions.json', 'analysis/responsive.json', 'screenshots/desktop/full-page.png']) {
      expect(zip.file(name), name).toBeTruthy();
    }
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.schemaVersion).toBe('2.0.0');
    expect(manifest.projectId).toBe(projectId);
  });
});

describe('analysis cancellation', () => {
  it('stops before launching Chromium when the job is already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(analyzeSite({
      url: 'https://example.com/',
      projectId: '11111111-1111-4111-8111-111111111111',
      projectDir: mkdtempSync(join(tmpdir(), 'tf-cancel-')),
      signal: controller.signal,
    })).rejects.toBeInstanceOf(CancelledError);
    expect(browserCount()).toBe(0);
  });
});

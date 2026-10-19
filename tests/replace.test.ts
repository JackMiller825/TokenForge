import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
import { ProjectStore } from '../src/lib/projects/store';
import { catalogFrom } from '../src/lib/replace/catalog';
import { openProjectStudio, saveProjectStudio, writeStudioFile } from '../src/lib/replace/disk';
import { writeReplacementPackage } from '../src/lib/replace/export';
import { inspectUpload, sanitizeSvg } from '../src/lib/replace/inspect';
import { readinessReport } from '../src/lib/replace/readiness';
import { aspectLabel } from '../src/lib/replace/ratio';
import { validateReplacementPackage } from '../src/lib/replace/schema';
import { applyStudioAction, freshStudio, rememberUpload } from '../src/lib/replace/studio';
import { suggestFor } from '../src/lib/replace/suggest';
import { renderVariant } from '../src/lib/replace/transform';
import type { CatalogItem, UploadedAsset } from '../src/lib/replace/model';
import type { ScanResult } from '../src/lib/types';

async function png(width = 30, height = 10, alpha = true): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 4, background: { r: 20, g: 180, b: 40, alpha: alpha ? 0.8 : 1 } } }).png().toBuffer();
}

function catalogItem(patch: Partial<CatalogItem> = {}): CatalogItem {
  return {
    manifestAssetId: 'hero',
    filename: 'hero-banner.webp',
    category: 'images',
    url: 'https://example.com/hero-banner.webp',
    pageUrl: 'https://example.com/',
    sectionId: 'hero',
    sectionRole: 'hero',
    kind: 'img',
    width: 1500,
    height: 500,
    objectFit: 'cover',
    objectPosition: '50% 50%',
    opacity: '1',
    transform: 'none',
    borderRadius: '0px',
    zIndex: '1',
    animated: false,
    usage: 2,
    responsive: true,
    ...patch,
  };
}

function upload(patch: Partial<UploadedAsset> = {}): UploadedAsset {
  return {
    id: 'upload-1',
    originalFilename: 'new-banner.png',
    relativePath: 'studio/uploads/upload-1.png',
    mimeType: 'image/png',
    extension: 'png',
    bytes: 100,
    width: 1500,
    height: 500,
    aspect: '3:1',
    hasAlpha: true,
    animated: false,
    contentHash: 'abc',
    containsText: 'unknown',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: 'hero-banner',
    roleInferred: true,
    ...patch,
  };
}

describe('replacement inspection', () => {
  it('reads a real PNG signature and rejects a mismatched extension', async () => {
    const buffer = await png();
    const inspected = inspectUpload(buffer, 'mascot.png');
    expect(inspected.extension).toBe('png');
    expect(inspected.width).toBe(30);
    expect(inspected.height).toBe(10);
    expect(inspected.aspect).toBe('3:1');
    expect(inspected.hasAlpha).toBe(true);
    expect(inspected.contentHash).toHaveLength(64);
    expect(() => inspectUpload(buffer, 'mascot.jpg')).toThrow(/signature/i);
    expect(() => inspectUpload(Buffer.from('not an image'), 'notes.png')).toThrow(/not an image/i);
  });

  it('strips active SVG content before preview', () => {
    const clean = sanitizeSvg('<svg onload="alert(1)"><script>alert(1)</script><rect width="1" height="1"/></svg>');
    expect(clean).not.toMatch(/script|onload/i);
  });
});

describe('replacement mapping', () => {
  it('suggests a compatible banner without approving it', () => {
    const suggestion = suggestFor(catalogItem(), 'hero-banner', [upload()]);
    expect(suggestion?.confidence).toBeGreaterThanOrEqual(0.45);
    expect(suggestion?.explanation).toMatch(/3:1/);
    const studio = freshStudio('p', null, null);
    studio.roles.push({ manifestAssetId: 'hero', role: 'hero-banner', roleInferred: true, confidence: 0.6, reason: 'guess', containsText: 'unknown', scope: 'replace' });
    studio.mappings.push({ id: 'map-hero', manifestAssetId: 'hero', uploadId: null, derivedId: null, state: 'not-mapped', confidence: 0, explanation: '', placement: 'use-upload', overrides: {}, revision: 0, updatedAt: '' });
    studio.uploads.push(upload());
    const suggested = applyStudioAction(studio, [catalogItem()], { action: 'suggest' });
    expect(suggested.mappings[0]?.state).toBe('suggested');
    expect(suggested.mappings.some((mapping) => mapping.state === 'approved')).toBe(false);
  });

  it('keeps a low-confidence approval in review and restores the original mapping', () => {
    const studio = freshStudio('p', null, null);
    studio.mappings.push({ id: 'map-hero', manifestAssetId: 'hero', uploadId: 'upload-1', derivedId: null, state: 'suggested', confidence: 0.4, explanation: 'weak', placement: 'use-upload', overrides: {}, revision: 1, updatedAt: '' });
    const reviewed = applyStudioAction(studio, [], { action: 'state', manifestAssetId: 'hero', state: 'approved' });
    expect(reviewed.mappings[0]?.state).toBe('needs-review');
    const restored = applyStudioAction(reviewed, [], { action: 'restore', manifestAssetId: 'hero' });
    expect(restored.mappings[0]?.state).toBe('not-mapped');
    expect(restored.mappings[0]?.uploadId).toBeNull();
    const undone = applyStudioAction(restored, [], { action: 'undo' });
    expect(undone.mappings[0]?.state).toBe('needs-review');
  });

  it('reuses a file with the same hash and reports readiness from the replace scope', async () => {
    const buffer = await png();
    const inspected = inspectUpload(buffer, 'banner.png');
    let studio = freshStudio('p', null, null);
    const first = rememberUpload(studio, inspected, '11111111-1111-4111-8111-111111111111');
    const second = rememberUpload(first.studio, inspected);
    expect(second.reused).toBe(true);
    expect(second.studio.uploads).toHaveLength(1);
    studio = first.studio;
    studio.roles.push({ manifestAssetId: 'hero', role: 'hero-banner', roleInferred: false, confidence: 1, reason: 'set', containsText: 'unknown', scope: 'replace' });
    studio.roles.push({ manifestAssetId: 'script', role: 'other', roleInferred: true, confidence: 0.3, reason: 'code', containsText: 'unknown', scope: 'not-applicable' });
    studio.mappings.push(
      { id: 'map-hero', manifestAssetId: 'hero', uploadId: first.upload.id, derivedId: null, state: 'approved', confidence: 0.9, explanation: 'ready', placement: 'use-upload', overrides: {}, revision: 2, updatedAt: '' },
      { id: 'map-script', manifestAssetId: 'script', uploadId: null, derivedId: null, state: 'not-mapped', confidence: 0, explanation: '', placement: 'use-upload', overrides: {}, revision: 0, updatedAt: '' },
    );
    const report = readinessReport(studio, [catalogItem(), catalogItem({ manifestAssetId: 'script', filename: 'app.js', category: 'scripts', width: undefined, height: undefined })]);
    expect(report.inScope).toBe(1);
    expect(report.approved).toBe(1);
    expect(report.percent).toBe(100);
    expect(aspectLabel(1500, 500)).toBe('3:1');
  });
});

describe('image variants and package export', () => {
  it('pads a contain variant without discarding transparency', async () => {
    const source = await png(20, 20);
    const variant = await renderVariant(source, { width: 40, height: 20, fit: 'contain', format: 'png' });
    expect(variant.width).toBe(40);
    expect(variant.height).toBe(20);
    const corner = await sharp(variant.buffer).ensureAlpha().raw().toBuffer();
    expect(corner[3]).toBe(0);
  });

  it('writes a schema 3 package and rejects a missing upload file', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tf-replace-'));
    const store = new ProjectStore(root, 'json');
    const project = store.create({ name: 'Whale', url: 'https://example.com/' });
    const scan: ScanResult = {
      manifestVersion: '1.0.0', pageUrl: 'https://example.com/', finalUrl: 'https://example.com/', title: 'Example', scannedAt: '', completedAt: '', mode: 'quick', pages: ['https://example.com/'], warnings: [],
      assets: [{ id: 'hero', url: 'https://example.com/hero.png', sourceUrl: 'https://example.com/hero.png', resolvedUrl: 'https://example.com/hero.png', originalFilename: 'hero.png', filename: 'hero.png', savedFilename: 'hero.png', filenameInferred: false, category: 'images', source: 'dom', discoveryMethod: 'dom', references: [{ pageUrl: 'https://example.com/', method: 'dom' }], width: 30, height: 10 }],
      stats: { discovered: 1, byCategory: { images: 1, videos: 0, fonts: 0, audio: 0, styles: 0, scripts: 0, documents: 0, other: 0 } },
    };
    store.saveScan(project.id, scan);
    const opened = openProjectStudio(store, project.id);
    expect(opened?.catalog).toHaveLength(1);
    const buffer = await png();
    const inspected = inspectUpload(buffer, 'new-banner.png');
    const saved = rememberUpload(opened!.studio, inspected, '22222222-2222-4222-8222-222222222222');
    writeStudioFile(opened!.dir, saved.upload.relativePath, buffer);
    const mapped = applyStudioAction(saved.studio, catalogFrom(scan, null), { action: 'map', manifestAssetId: 'hero', uploadId: saved.upload.id });
    saveProjectStudio(store, project.id, mapped, scan, null);
    const zipPath = join(root, 'tokenforge-replacement-package.zip');
    const outcome = await writeReplacementPackage(zipPath, opened!.dir, mapped, scan, null);
    expect(outcome.errors).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    for (const name of ['README.md', 'manifest.json', 'original-manifest/phase1-manifest.json', 'original-manifest/phase2-blueprint-manifest.json', 'mapping/replacement-map.json', 'mapping/asset-roles.json', 'mapping/section-replacements.json', 'mapping/compatibility-report.json', 'mapping/phase4-contract.json', 'mapping/phase5-contract.json', 'reports/readiness-report.json', 'reports/validation-report.json']) {
      expect(zip.file(name), name).toBeTruthy();
    }
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.schemaVersion).toBe('3.0.0');
    const broken = validateReplacementPackage({ studio: { ...mapped, uploads: [{ ...saved.upload, relativePath: 'studio/uploads/missing.png' }] }, readiness: readinessReport(mapped, catalogFrom(scan, null)), filesOnDisk: [] });
    expect(broken.some((error) => error.includes('Missing upload file'))).toBe(true);
  });
});

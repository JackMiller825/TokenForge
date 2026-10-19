import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import type { AnalysisResult, SectionRecord } from '../src/lib/analyze/model';
import { authorize } from '../src/lib/http/guard';
import { brandReport } from '../src/lib/identity/consistency';
import { compareIdentity, normalizeIdentity, setTone } from '../src/lib/identity/document';
import { openIdentity, saveIdentity, writeRevision } from '../src/lib/identity/disk';
import { writeIdentityPackage } from '../src/lib/identity/export';
import { emptyIdentity } from '../src/lib/identity/model';
import { phase5Readiness } from '../src/lib/identity/readiness';
import { sanitizeRichText } from '../src/lib/identity/sanitize';
import { validateIdentityPackage } from '../src/lib/identity/schema';
import { applyEmptySuggestions } from '../src/lib/identity/suggest';
import { addressValid, validateIdentity } from '../src/lib/identity/validate';
import { ProjectStore } from '../src/lib/projects/store';
import { freshStudio } from '../src/lib/replace/studio';
import { writeStudio } from '../src/lib/replace/disk';
import type { ScanResult } from '../src/lib/types';
import { PATCH } from '../src/app/api/projects/[id]/identity/route';
import { resetProjectsForTests } from '../src/lib/projects/store';

function section(id: string, role: string, name: string): SectionRecord {
  return {
    id, role, roleInferred: true, name, confidence: 0.8, selector: 'main', alternateSelector: '', viewport: 'desktop',
    x: 0, y: 0, width: 100, height: 40, background: '', padding: '', margin: '', display: 'block', layout: 'stack',
    headings: [], textSample: '', assetIds: [], interactiveCount: 0, overlapping: false, position: 'static', corrected: false,
  };
}

function analysis(projectId: string, url: string): AnalysisResult {
  return {
    schemaVersion: '2.0.0', projectId, url, finalUrl: url, title: 'Old Meme Coin', analyzedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:00.000Z',
    demo: false, warnings: [], pages: [{ url, title: 'Old Meme Coin' }], screenshots: [],
    sections: [section('section-hero', 'hero', 'Hero'), section('section-community', 'community', 'Community')],
    designSystem: { declaredVariables: [], colors: [{ value: '#123456', count: 2, roles: ['accent'], declared: false }], gradients: [], fonts: [], radii: [], borders: [], shadows: [], containers: [], columns: [], spacing: [], breakpoints: [] },
    assetMap: [], animations: [], interactions: [], responsive: [], manifestAssetIds: [],
  };
}

function scan(url: string): ScanResult {
  return {
    manifestVersion: '1.0.0', pageUrl: url, finalUrl: url, title: 'Old Meme Coin', scannedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:00.000Z',
    mode: 'quick', pages: [url], warnings: [], assets: [],
    stats: { discovered: 0, byCategory: { images: 0, videos: 0, fonts: 0, audio: 0, styles: 0, scripts: 0, documents: 0, other: 0 } },
  };
}

describe('token identity validation', () => {
  it('keeps ticker capitalization and checks each chain', () => {
    const doc = emptyIdentity('project');
    doc.token.name = 'New Cat';
    doc.token.ticker = 'AbC';
    expect(normalizeIdentity(doc).token.ticker).toBe('AbC');
    doc.token.ticker = 'too-long-symbol';
    expect(validateIdentity(doc).some((issue) => issue.field === 'token.ticker' && issue.severity === 'block')).toBe(true);
    expect(addressValid('ethereum', '0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(addressValid('base', '0x1234')).toBe(false);
    expect(addressValid('solana', 'So11111111111111111111111111111111111111112')).toBe(true);
    doc.token.networkId = 'ethereum';
    doc.token.contractStatus = 'configured';
    doc.token.contractAddress = 'not-an-address';
    expect(validateIdentity(doc).some((issue) => issue.code === 'contract')).toBe(true);
    doc.token.contractStatus = 'coming-soon';
    doc.token.contractAddress = '0x1234567890abcdef1234567890abcdef12345678';
    expect(validateIdentity(doc).some((issue) => issue.message.includes('Coming Soon'))).toBe(true);
    doc.token.contractStatus = 'unverified';
    doc.token.contractAddress = '0x1234567890abcdef1234567890abcdef12345678';
    expect(validateIdentity(doc).some((issue) => issue.severity === 'warn' && issue.code === 'unverified')).toBe(true);
  });

  it('treats burned liquidity as planned until evidence is verified', () => {
    const doc = emptyIdentity('project');
    const issues = validateIdentity(doc);
    expect(issues.some((issue) => issue.code === 'liquidity' && issue.severity === 'warn')).toBe(true);
    doc.tokenomics.liquidityEvidence = 'verified';
    doc.tokenomics.ownershipEvidence = 'verified';
    expect(validateIdentity(doc).some((issue) => issue.code === 'liquidity')).toBe(false);
  });

  it('removes active content from rich text and rejects a bad link', () => {
    const clean = sanitizeRichText('<p onclick="alert(1)">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://example.com">ok</a>');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('rel="noopener noreferrer"');
    const doc = emptyIdentity('project');
    doc.links = [{ id: 'telegram', type: 'telegram', label: 'Telegram', url: 'https://t.me/example', enabled: true, status: 'coming-soon', locations: ['footer'], icon: '' }];
    expect(validateIdentity(doc).some((issue) => issue.code === 'link')).toBe(true);
  });
});

describe('identity profile storage', () => {
  it('saves beside the scan and blueprint and keeps older projects readable', () => {
    const root = mkdtempSync(join(tmpdir(), 'tokenforge-identity-'));
    const store = new ProjectStore(root, 'json');
    const project = store.create({ name: 'Reference', url: 'https://example.com/' });
    store.saveScan(project.id, scan(project.url));
    store.saveAnalysis(project.id, analysis(project.id, project.url));
    const studio = freshStudio(project.id, store.readScan(project.id), store.readAnalysis(project.id));
    writeStudio(store.dir(project.id), studio);
    const scanBefore = readFileSync(join(store.dir(project.id), 'scan.json'));
    const analysisBefore = readFileSync(join(store.dir(project.id), 'analysis.json'));
    const studioBefore = readFileSync(join(store.dir(project.id), 'studio.json'));
    const opened = openIdentity(store, project.id);
    expect(opened?.identity.sections.map((item) => item.id)).toEqual(['section-hero', 'section-community']);
    expect(opened?.identity.referenceTitle).toBe('Old Meme Coin');
    const saved = saveIdentity(store, project.id, { ...opened!.identity, token: { ...opened!.identity.token, name: 'New Cat', ticker: 'AbC' } });
    expect(saved?.identity.token.ticker).toBe('AbC');
    expect(readFileSync(join(store.dir(project.id), 'scan.json')).equals(scanBefore)).toBe(true);
    expect(readFileSync(join(store.dir(project.id), 'analysis.json')).equals(analysisBefore)).toBe(true);
    expect(readFileSync(join(store.dir(project.id), 'studio.json')).equals(studioBefore)).toBe(true);
    const again = openIdentity(store, project.id);
    expect(again?.identity.token.name).toBe('New Cat');
    expect(again?.project.identityStatus).toBe('ready');
  });

  it('stores a revision, restores it, and round-trips an import', () => {
    const root = mkdtempSync(join(tmpdir(), 'tokenforge-identity-rev-'));
    const store = new ProjectStore(root, 'json');
    const project = store.create({ name: 'Reference', url: 'https://example.com/token' });
    const opened = openIdentity(store, project.id)!;
    const first = saveIdentity(store, project.id, { ...opened.identity, token: { ...opened.identity.token, name: 'First', ticker: 'ONE' } })!;
    const revised = writeRevision(store.dir(project.id), first.identity, 'First draft');
    const second = saveIdentity(store, project.id, { ...revised, token: { ...revised.token, name: 'Second', ticker: 'TWO' } })!;
    const snapshot = JSON.parse(readFileSync(join(store.dir(project.id), 'identity', 'revisions', `${second.identity.revisions[0]!.id}.json`), 'utf8'));
    expect(snapshot.token.name).toBe('First');
    const restored = saveIdentity(store, project.id, { ...snapshot, revisions: second.identity.revisions });
    expect(restored?.identity.token.ticker).toBe('ONE');
    const imported = normalizeIdentity(JSON.parse(JSON.stringify({ ...second.identity, token: { ...second.identity.token, name: 'Imported', ticker: 'IMP' } })));
    expect(imported.token.name).toBe('Imported');
    expect(imported.token.ticker).toBe('IMP');
    expect(() => normalizeIdentity(JSON.parse('{"schemaVersion":"1.0.0"}'))).toThrow(/schema/);
    expect(compareIdentity(first.identity, second.identity).some((change) => change.field === 'token.name')).toBe(true);
  });

  it('does not overwrite approved or filled copy when the tone changes', () => {
    const doc = emptyIdentity('project');
    doc.token.name = 'New Cat';
    doc.token.ticker = 'CAT';
    doc.narrative.origin = '<p>Custom origin</p>';
    doc.approvedFields = ['token.tagline'];
    doc.token.tagline = 'Keep this';
    const toned = setTone(doc, 'sports');
    expect(toned.narrative.origin).toContain('Custom origin');
    const filled = applyEmptySuggestions(toned).document;
    expect(filled.token.tagline).toBe('Keep this');
    expect(filled.narrative.origin).toContain('Custom origin');
    expect(filled.token.shortDescription.toLowerCase()).toContain('court');
    expect(filled.token.shortDescription).toContain('not a promise');
  });
});

describe('brand report, readiness, and export', () => {
  it('flags the reference name and separates blockers from warnings', () => {
    const doc = emptyIdentity('project', 'Old Meme Coin', 'https://example.com/');
    doc.narrative.origin = 'Remember Meme from the old site. Contract 0x1234567890abcdef1234567890abcdef12345678.';
    const report = brandReport(doc, [{ id: 'art', filename: 'logo.png' }]);
    expect(report.some((item) => item.code === 'stale-name')).toBe(true);
    expect(report.some((item) => item.code === 'stale-address')).toBe(true);
    expect(report.some((item) => item.code === 'image-text' && item.message.includes('logo.png'))).toBe(true);
    doc.exceptions = ['Meme'];
    expect(brandReport(doc).some((item) => item.message.includes('Meme'))).toBe(false);
    const blocked = phase5Readiness(doc, null, null, null);
    expect(blocked.ready).toBe(false);
    expect(blocked.blockers.some((item) => item.code === 'name')).toBe(true);
    doc.token.name = 'New Cat';
    doc.token.ticker = 'CAT';
    doc.sections = [{ id: 'section-hero', sourceSectionId: 'section-hero', order: 0, hidden: false, displayName: 'Hero', purpose: 'hero', headline: 'New Cat', subheadline: '', description: '', body: '', mobileCopy: '', primaryButton: '', secondaryButton: '', buttonDestination: '', assetIds: [], backgroundAssetId: '', notes: '', duplicated: false }];
    const ready = phase5Readiness(doc, analysis('project', 'https://example.com/'), null, null);
    expect(ready.blockers.some((item) => item.code === 'name')).toBe(false);
    expect(ready.ready).toBe(true);
    expect(ready.warnings.some((item) => item.code === 'replacements' || item.code === 'liquidity')).toBe(true);
  });

  it('writes a schema 4.0.0 package that points at phase 3 ids', async () => {
    const root = mkdtempSync(join(tmpdir(), 'tokenforge-identity-zip-'));
    const doc = emptyIdentity('project', 'Old Meme Coin', 'https://example.com/');
    doc.token.name = 'New Cat';
    doc.token.ticker = 'CAT';
    const zipPath = join(root, 'tokenforge-identity-package.zip');
    const outcome = await writeIdentityPackage(zipPath, doc, null, null, []);
    expect(outcome.errors).toEqual([]);
    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    const names = Object.keys(zip.files).filter((name) => !name.endsWith('/'));
    expect(validateIdentityPackage(doc, names)).toEqual([]);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.schemaVersion).toBe('4.0.0');
    expect(manifest.references.phase3ApprovedAssetIds).toEqual([]);
    const input = JSON.parse(await zip.file('mapping/phase5-input.json')!.async('string'));
    expect(input.identity.token.ticker).toBe('CAT');
    expect(await zip.file('README.md')!.async('string')).toMatch(/Coming Soon/);
  });
});

describe('identity API guard', () => {
  it('requires the server token and rejects an unknown action', async () => {
    const previous = process.env.TOKENFORGE_AUTH_TOKEN;
    process.env.TOKENFORGE_AUTH_TOKEN = 'secret';
    try {
      const blocked = authorize(new Request('http://127.0.0.1:3000/api/projects/x/identity', { method: 'PATCH', headers: { origin: 'http://127.0.0.1:3000' } }), 'identity');
      expect(blocked?.status).toBe(401);
      const root = mkdtempSync(join(tmpdir(), 'tokenforge-identity-api-'));
      const store = resetProjectsForTests(root);
      const project = store.create({ name: 'Reference', url: 'https://example.com/' });
      const denied = await PATCH(new Request('http://127.0.0.1:3000/api/projects/x/identity', { method: 'PATCH', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ id: project.id }) });
      expect(denied.status).toBe(401);
      const invalid = await PATCH(new Request('http://127.0.0.1:3000/api/projects/x/identity', {
        method: 'PATCH',
        headers: { origin: 'http://127.0.0.1:3000', authorization: 'Bearer secret', 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'nope' }),
      }), { params: Promise.resolve({ id: project.id }) });
      expect(invalid.status).toBe(400);
    } finally {
      if (previous === undefined) delete process.env.TOKENFORGE_AUTH_TOKEN;
      else process.env.TOKENFORGE_AUTH_TOKEN = previous;
    }
  });
});

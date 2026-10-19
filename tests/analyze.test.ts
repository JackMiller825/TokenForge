import { describe, expect, it } from 'vitest';
import { compareAnalyses, inferRole, interpretProbe } from '../src/lib/analyze/interpret';
import { matchManifest } from '../src/lib/analyze/match';
import type { RawProbe, RawSection } from '../src/lib/analyze/model';
import { validateBlueprint } from '../src/lib/analyze/schema';
import { parseAnalyzeInput } from '../src/lib/jobs/input';
import { assertPublicUrl } from '../src/lib/security/network';

const section = (patch: Partial<RawSection>): RawSection => ({
  selector: 'section',
  alternateSelector: 'section',
  tag: 'section',
  roleAttr: '',
  idAttr: '',
  className: '',
  headings: [],
  textSample: '',
  box: { x: 0, y: 200, width: 800, height: 300 },
  background: 'rgb(0, 0, 0)',
  padding: '16px',
  margin: '0px',
  display: 'block',
  position: 'static',
  zIndex: 'auto',
  layout: 'block',
  interactiveCount: 0,
  ...patch,
});

const probe = (overrides: Partial<RawProbe> = {}): RawProbe => ({
  title: 'Fixture',
  url: 'https://example.com/',
  scrollWidth: 1440,
  scrollHeight: 1200,
  viewportWidth: 1440,
  viewportHeight: 900,
  sections: [section({ tag: 'header', box: { x: 0, y: 0, width: 1440, height: 64 } }), section({ className: 'token', headings: ['Token'], textSample: 'supply' })],
  assets: [],
  styles: [{ color: 'rgb(255, 255, 255)', background: 'rgb(10, 10, 10)', fontFamily: 'Georgia, serif', fontWeight: '400', fontSize: '16px', lineHeight: '24px', letterSpacing: '0px', radius: '8px', border: '0px none', shadow: 'none', maxWidth: '1120px', gap: '16px', padding: '16px', margin: '0px', columns: 3 }],
  variables: [{ name: '--brand', value: '#2563eb' }],
  breakpoints: ['(max-width: 800px)'],
  gradients: [],
  motions: [],
  brokenMedia: 0,
  hiddenCount: 1,
  ...overrides,
});

describe('asset URL matching', () => {
  const assets = [
    { id: 'a', url: 'https://cdn.example.com/logo.png', sourceUrl: 'https://cdn.example.com/logo.png', resolvedUrl: 'https://cdn.example.com/logo.png' },
    { id: 'b', url: 'https://cdn.example.com/logo.png?v=2', sourceUrl: 'https://cdn.example.com/logo.png?v=2', resolvedUrl: 'https://cdn.example.com/logo.png?v=2' },
  ];

  it('keeps query variants distinct', () => {
    expect(matchManifest('https://cdn.example.com/logo.png', assets).id).toBe('a');
    expect(matchManifest('https://cdn.example.com/logo.png?v=2', assets).id).toBe('b');
    expect(matchManifest('https://CDN.example.com/logo.png', assets)).toEqual({ id: 'a', match: 'canonical' });
  });

  it('does not merge two assets that share only a path when queries differ', () => {
    expect(matchManifest('https://cdn.example.com/other.png?x=1', assets).match).toBe('none');
  });
});

describe('section interpretation', () => {
  it('treats a header landmark as observed and a token block as inferred', () => {
    const header = inferRole(section({ tag: 'header', box: { x: 0, y: 0, width: 100, height: 40 } }), 0, 1000);
    expect(header.role).toBe('header');
    expect(header.inferred).toBe(false);
    const token = inferRole(section({ className: 'token-card', headings: ['Tokenomics'], textSample: 'supply' }), 2, 1000);
    expect(token.role).toBe('token');
    expect(token.inferred).toBe(true);
    expect(token.confidence).toBeLessThan(1);
  });

  it('maps an image into the section that contains it and counts declared colors', () => {
    const result = interpretProbe(probe({
      assets: [{
        selector: 'img',
        kind: 'img',
        url: 'https://cdn.example.com/logo.png',
        box: { x: 10, y: 10, width: 40, height: 40 },
        naturalWidth: 40,
        naturalHeight: 40,
        objectFit: 'cover',
        objectPosition: '50% 50%',
        opacity: '1',
        transform: 'none',
        borderRadius: '0px',
        zIndex: 'auto',
        animated: false,
        sectionIndex: 0,
      }],
    }), [{ id: 'a', url: 'https://cdn.example.com/logo.png', sourceUrl: 'https://cdn.example.com/logo.png', resolvedUrl: 'https://cdn.example.com/logo.png' }]);
    expect(result.assetMap[0]?.sectionId).toBe(result.sections[0]?.id);
    expect(result.assetMap[0]?.manifestAssetId).toBe('a');
    expect(result.designSystem.declaredVariables[0]?.name).toBe('--brand');
    expect(result.designSystem.columns).toContain(3);
    expect(result.warnings.some((warning) => warning.includes('hidden'))).toBe(true);
  });
});

describe('blueprint schema', () => {
  it('rejects a package that lost a screenshot', () => {
    const analysis = interpretProbe(probe(), []);
    const manifest = {
      schemaVersion: '2.0.0' as const,
      projectId: 'p',
      url: 'https://example.com/',
      finalUrl: 'https://example.com/',
      title: 'Fixture',
      analyzedAt: '',
      completedAt: '',
      demo: false,
      warnings: [],
      pages: [{ url: 'https://example.com/', title: 'Fixture' }],
      screenshots: [{ id: 's', viewport: 'desktop', kind: 'full-page' as const, file: 'screenshots/desktop/full-page.png', width: 1, height: 1, deviceScaleFactor: 1, partial: false }],
      sections: analysis.sections,
      designSystem: analysis.designSystem,
      assetMap: analysis.assetMap,
      animations: [],
      interactions: [],
      responsive: [],
      manifestAssetIds: [],
    };
    const errors = validateBlueprint({
      manifest,
      pages: manifest.pages,
      sections: manifest.sections,
      designSystem: manifest.designSystem,
      assetMap: manifest.assetMap,
      animations: [],
      interactions: [],
      responsive: [],
      screenshotFiles: [],
    });
    expect(errors.some((error) => error.includes('full-page.png'))).toBe(true);
  });

  it('compares section roles between versions', () => {
    const left = interpretProbe(probe(), []);
    const right = interpretProbe(probe({ sections: [section({ tag: 'footer', box: { x: 0, y: 900, width: 800, height: 80 } })] }), []);
    const diff = compareAnalyses(left, right);
    expect(diff.rolesRemoved).toContain('header');
    expect(diff.rolesAdded).toContain('footer');
  });
});

describe('analysis requests', () => {
  it('rejects a private URL before a browser starts', async () => {
    expect(() => parseAnalyzeInput({ url: 'not a url' })).toThrow(/valid/i);
    await expect(assertPublicUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/blocked|private|unroutable/i);
  });

  it('ignores loopback exceptions from the client payload', () => {
    const parsed = parseAnalyzeInput({ url: 'https://example.com/', testAllowHosts: ['127.0.0.1'] });
    expect(parsed).toEqual({ url: 'https://example.com/', projectId: undefined });
    expect('testAllowHosts' in parsed).toBe(false);
  });
});

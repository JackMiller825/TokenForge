import type { AnalysisResult, ReferenceProject } from '../analyze/model';

export const DEMO_PROJECT: ReferenceProject = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Sample blueprint',
  url: 'https://example.com/',
  title: 'Sample blueprint',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  assetScanStatus: 'none',
  analysisStatus: 'completed',
  versions: [{ id: '00000000-0000-4000-8000-000000000002', createdAt: '2026-01-01T00:00:00.000Z', label: 'Demo' }],
  warnings: ['Demo mode. This blueprint is sample data, not an analysis of a live website.'],
  demo: true,
};

export const DEMO_ANALYSIS: AnalysisResult = {
  schemaVersion: '2.0.0',
  projectId: DEMO_PROJECT.id,
  url: 'https://example.com/',
  finalUrl: 'https://example.com/',
  title: 'Sample blueprint',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:00.000Z',
  demo: true,
  warnings: ['Demo mode. These sections, colors, and mappings were not captured from a website.'],
  pages: [{ url: 'https://example.com/', title: 'Sample blueprint' }],
  screenshots: [],
  sections: [
    { id: 'section_demo_header', role: 'header', roleInferred: true, name: 'Header', confidence: 0.5, selector: 'header', alternateSelector: 'header', viewport: 'desktop', x: 0, y: 0, width: 1440, height: 72, background: '#10141c', padding: '16px', margin: '0px', display: 'flex', layout: 'flex', headings: [], textSample: 'Sample navigation', assetIds: ['map_demo_logo'], interactiveCount: 4, overlapping: false, position: 'sticky', corrected: false },
    { id: 'section_demo_hero', role: 'hero', roleInferred: true, name: 'Hero', confidence: 0.5, selector: 'section.hero', alternateSelector: '.hero', viewport: 'desktop', x: 0, y: 72, width: 1440, height: 420, background: '#171d27', padding: '48px', margin: '0px', display: 'flex', layout: 'flex', headings: ['Sample hero'], textSample: 'Sample hero copy', assetIds: ['map_demo_mascot'], interactiveCount: 2, overlapping: false, position: 'relative', corrected: false },
    { id: 'section_demo_footer', role: 'footer', roleInferred: false, name: 'Footer', confidence: 0.9, selector: 'footer', alternateSelector: 'footer', viewport: 'desktop', x: 0, y: 980, width: 1440, height: 120, background: '#07090d', padding: '24px', margin: '0px', display: 'block', layout: 'block', headings: [], textSample: 'Sample footer', assetIds: [], interactiveCount: 1, overlapping: false, position: 'static', corrected: false },
  ],
  designSystem: {
    declaredVariables: [{ name: '--brand', value: '#c6f135' }],
    colors: [{ value: '#c6f135', count: 4, roles: ['text'], declared: true }, { value: '#10141c', count: 6, roles: ['background'], declared: false }],
    gradients: [],
    fonts: [{ family: 'Outfit', weights: ['600'], sizes: ['48px', '16px'], lineHeights: ['1.1', '1.5'], letterSpacings: ['0px'], count: 8 }],
    radii: [{ value: '16px', count: 5 }],
    borders: [],
    shadows: [],
    containers: [1120],
    columns: [3],
    spacing: [{ value: 16, count: 6 }, { value: 24, count: 3 }],
    breakpoints: ['(max-width: 800px)'],
  },
  assetMap: [
    { id: 'map_demo_logo', pageUrl: 'https://example.com/', sectionId: 'section_demo_header', selector: 'header img', kind: 'img', sourceUrl: 'https://example.com/logo.png', resolvedUrl: 'https://example.com/logo.png', manifestAssetId: null, match: 'none', box: { x: 24, y: 16, width: 40, height: 40 }, objectFit: 'contain', objectPosition: '50% 50%', opacity: '1', transform: 'none', borderRadius: '8px', zIndex: 'auto', animated: false, corrected: false },
    { id: 'map_demo_mascot', pageUrl: 'https://example.com/', sectionId: 'section_demo_hero', selector: '.hero img', kind: 'img', sourceUrl: 'https://example.com/mascot.png', resolvedUrl: 'https://example.com/mascot.png', manifestAssetId: null, match: 'none', box: { x: 860, y: 140, width: 360, height: 360 }, objectFit: 'cover', objectPosition: '50% 50%', opacity: '1', transform: 'none', borderRadius: '24px', zIndex: '1', animated: false, corrected: false },
  ],
  animations: [],
  interactions: [{ id: 'motion_demo_sticky', kind: 'sticky', trigger: 'scroll', properties: ['position'], selector: 'header', sectionId: 'section_demo_header', confidence: 0.5, limitation: 'Sample record. No page was measured.' }],
  responsive: [
    { viewport: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, sectionCount: 3, scrollWidth: 1440, scrollHeight: 1100, overflow: false, notes: [] },
    { viewport: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1, sectionCount: 3, scrollWidth: 768, scrollHeight: 1400, overflow: false, notes: ['Sample note only.'] },
    { viewport: 'mobile', width: 390, height: 844, deviceScaleFactor: 1, sectionCount: 3, scrollWidth: 390, scrollHeight: 1800, overflow: false, notes: ['Sample note only.'] },
  ],
  manifestAssetIds: [],
};

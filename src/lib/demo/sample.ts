import type { AssetRecord, ScanResult } from '../types';
import { withBase } from '../format';

export const SAMPLE_ASSETS: AssetRecord[] = [
  asset('a11ce001a11ce001', '/demo/mascot.svg', 'mascot.svg', 'images', 'image/svg+xml', 'svg', 0),
  asset('b22ce002b22ce002', '/demo/banner.svg', 'banner.svg', 'images', 'image/svg+xml', 'svg', 1),
  asset('c33ce003c33ce003', '/demo/mark.svg', 'mark.svg', 'images', 'image/svg+xml', 'svg', 2),
  asset('d44ce004d44ce004', '/demo/pattern.svg', 'pattern.svg', 'images', 'image/svg+xml', 'svg', 3),
  asset('e55ce005e55ce005', '/demo/theme.css', 'theme.css', 'styles', 'text/css', 'css', 4),
  asset('f66ce006f66ce006', '/demo/notes.txt', 'notes.txt', 'documents', 'text/plain', 'txt', 5),
];

function asset(id: string, path: string, name: string, category: AssetRecord['category'], mime: string, extension: string, index: number): AssetRecord {
  const folder = category;
  return {
    id,
    url: path,
    sourceUrl: path,
    resolvedUrl: path,
    originalFilename: name,
    filename: name,
    savedFilename: name,
    filenameInferred: false,
    outputPath: `${folder}/${name}`,
    category,
    mimeType: mime,
    extension,
    bytes: undefined,
    width: category === 'images' ? (index === 1 ? 1200 : 640) : undefined,
    height: category === 'images' ? (index === 1 ? 480 : 640) : undefined,
    source: 'dom',
    discoveryMethod: 'dom',
    references: [{ pageUrl: '/demo', method: 'dom' }],
    status: 'pending',
  };
}

export const SAMPLE_SCAN: ScanResult = {
  manifestVersion: '1.0.0',
  pageUrl: 'https://tokenforge.local/demo',
  finalUrl: 'https://tokenforge.local/demo',
  title: 'TokenForge sample library',
  scannedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:00:00.000Z',
  mode: 'quick',
  pages: ['https://tokenforge.local/demo'],
  warnings: ['This is a local sample library so you can inspect the dashboard without scanning a website.'],
  assets: SAMPLE_ASSETS,
  stats: {
    discovered: SAMPLE_ASSETS.length,
    byCategory: { images: 4, videos: 0, fonts: 0, audio: 0, styles: 1, scripts: 0, documents: 1, other: 0 },
  },
};

export async function downloadSampleZip() {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const item of SAMPLE_ASSETS) {
    const response = await fetch(withBase(item.sourceUrl));
    if (!response.ok) throw new Error(`Sample file missing: ${item.savedFilename}`);
    zip.file(item.outputPath || item.savedFilename, await response.arrayBuffer());
  }
  zip.file('manifest.json', JSON.stringify({
    manifestVersion: '1.0.0',
    generator: 'TokenForge/1.0.0',
    module: '01-reference-assets',
    pageUrl: SAMPLE_SCAN.finalUrl,
    title: SAMPLE_SCAN.title,
    scannedAt: SAMPLE_SCAN.scannedAt,
    completedAt: SAMPLE_SCAN.completedAt,
    exportedAt: new Date().toISOString(),
    site: { requestedUrl: SAMPLE_SCAN.pageUrl, finalUrl: SAMPLE_SCAN.finalUrl, title: SAMPLE_SCAN.title, mode: 'quick', pages: SAMPLE_SCAN.pages },
    structure: 'organized',
    warnings: SAMPLE_SCAN.warnings,
    summary: { discovered: SAMPLE_ASSETS.length, selected: SAMPLE_ASSETS.length, downloaded: SAMPLE_ASSETS.length, failed: 0, skipped: 0, bytes: 0 },
    assets: SAMPLE_ASSETS.map((item) => ({ ...item, status: 'downloaded' })),
    modules: { websiteAnalyzer: null, assetReplacementStudio: null, tokenIdentityStudio: null, websiteGenerator: null, visualComparison: null },
  }, null, 2));
  zip.file('README.md', 'TokenForge sample library. These files are original demo assets, not a scan of a third-party website.\n');
  const blob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'tokenforge-sample.zip';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 15000);
}

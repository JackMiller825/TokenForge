import { APP_VERSION } from '../config';
import { EMPTY_MODULES } from '../modules';
import { planPaths } from './names';
import { categoryCounts, type AssetRecord, type ManifestFile, type ScanResult, type ZipStructure } from '../types';

export function buildManifest(scan: ScanResult, assets: AssetRecord[], structure: ZipStructure, extraWarnings: string[] = []): ManifestFile {
  const downloaded = assets.filter((asset) => asset.status === 'downloaded');
  const failed = assets.filter((asset) => asset.status === 'failed');
  const skipped = assets.filter((asset) => asset.status === 'skipped');
  return {
    manifestVersion: '1.0.0',
    generator: `TokenForge/${APP_VERSION}`,
    module: '01-reference-assets',
    pageUrl: scan.finalUrl || scan.pageUrl,
    title: scan.title,
    scannedAt: scan.scannedAt,
    completedAt: scan.completedAt,
    exportedAt: new Date().toISOString(),
    site: {
      requestedUrl: scan.pageUrl,
      finalUrl: scan.finalUrl,
      title: scan.title,
      mode: scan.mode,
      pages: scan.pages,
    },
    structure,
    warnings: [...scan.warnings, ...extraWarnings],
    summary: {
      discovered: scan.assets.length,
      selected: assets.filter((asset) => asset.status !== 'skipped').length,
      downloaded: downloaded.length,
      failed: failed.length,
      skipped: skipped.length,
      bytes: downloaded.reduce((total, asset) => total + (asset.bytes || 0), 0),
    },
    assets,
    modules: EMPTY_MODULES,
  };
}

export function applyPlannedPaths(assets: AssetRecord[], structure: ZipStructure): AssetRecord[] {
  const selected = assets.filter((asset) => asset.status === 'downloaded' || asset.status === 'pending').map((asset) => asset.id);
  const paths = planPaths(assets, selected, structure);
  return assets.map((asset) => {
    const outputPath = paths.get(asset.id);
    if (!outputPath) return { ...asset, outputPath: undefined, filename: asset.savedFilename };
    return { ...asset, outputPath, filename: outputPath.split('/').pop() || asset.savedFilename, savedFilename: outputPath.split('/').pop() || asset.savedFilename };
  });
}

export function readmeFor(manifest: ManifestFile): string {
  return `# TokenForge reference assets

Source: ${manifest.site.finalUrl}
Requested: ${manifest.site.requestedUrl}
Scanned: ${manifest.scannedAt}
Exported: ${manifest.exportedAt}
Mode: ${manifest.site.mode}
Layout: ${manifest.structure}

Downloaded: ${manifest.summary.downloaded}
Failed: ${manifest.summary.failed}
Skipped: ${manifest.summary.skipped}
Bytes: ${manifest.summary.bytes}

\`manifest.json\` is version ${manifest.manifestVersion}. Each asset keeps its original source URL. \`filenameInferred\` is true when TokenForge added an extension or generated a name because the URL did not contain one. Colliding names receive a stable \`__2\` suffix.

These files belong to their respective owners. Collect them only when you are allowed to use them.
`;
}

export function summarizeCategories(assets: AssetRecord[]) {
  return categoryCounts(assets);
}

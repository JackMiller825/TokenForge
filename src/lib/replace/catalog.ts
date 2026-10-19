import type { AnalysisResult } from '../analyze/model';
import type { ScanResult } from '../types';
import type { CatalogItem } from './model';

export function catalogFrom(scan: ScanResult | null, analysis: AnalysisResult | null): CatalogItem[] {
  const placements = new Map<string, AnalysisResult['assetMap']>();
  for (const asset of analysis?.assetMap || []) {
    const key = asset.manifestAssetId || asset.id;
    const list = placements.get(key) || [];
    list.push(asset);
    placements.set(key, list);
  }
  const sections = new Map((analysis?.sections || []).map((section) => [section.id, section]));
  if (scan?.assets.length) {
    return scan.assets.map((asset) => {
      const maps = placements.get(asset.id) || [];
      const primary = maps[0];
      const section = primary?.sectionId ? sections.get(primary.sectionId) : undefined;
      return {
        manifestAssetId: asset.id,
        filename: asset.originalFilename || asset.filename,
        category: asset.category,
        url: asset.resolvedUrl || asset.url,
        pageUrl: asset.references[0]?.pageUrl || scan.pageUrl,
        sectionId: primary?.sectionId || null,
        sectionRole: section?.role || null,
        kind: primary?.kind || 'other',
        width: asset.width || primary?.naturalWidth,
        height: asset.height || primary?.naturalHeight,
        x: primary?.box.x,
        y: primary?.box.y,
        displayedWidth: primary?.box.width,
        displayedHeight: primary?.box.height,
        objectFit: primary?.objectFit || 'fill',
        objectPosition: primary?.objectPosition || '50% 50%',
        opacity: primary?.opacity || '1',
        transform: primary?.transform || 'none',
        borderRadius: primary?.borderRadius || '0px',
        zIndex: primary?.zIndex || 'auto',
        animated: Boolean(primary?.animated),
        usage: Math.max(1, asset.references.length, maps.length),
        responsive: maps.some((item) => item !== primary),
      };
    });
  }
  return (analysis?.assetMap || []).map((asset) => {
    const section = asset.sectionId ? sections.get(asset.sectionId) : undefined;
    return {
      manifestAssetId: asset.manifestAssetId || asset.id,
      filename: fileName(asset.sourceUrl),
      category: asset.kind === 'video' ? 'videos' : 'images',
      url: asset.resolvedUrl || asset.sourceUrl,
      pageUrl: asset.pageUrl,
      sectionId: asset.sectionId,
      sectionRole: section?.role || null,
      kind: asset.kind,
      width: asset.naturalWidth,
      height: asset.naturalHeight,
      x: asset.box.x,
      y: asset.box.y,
      displayedWidth: asset.box.width,
      displayedHeight: asset.box.height,
      objectFit: asset.objectFit,
      objectPosition: asset.objectPosition,
      opacity: asset.opacity,
      transform: asset.transform,
      borderRadius: asset.borderRadius,
      zIndex: asset.zIndex,
      animated: asset.animated,
      usage: 1,
      responsive: false,
    };
  });
}

function fileName(url: string): string {
  try {
    const name = new URL(url).pathname.split('/').pop() || '';
    return decodeURIComponent(name) || 'asset';
  } catch {
    return url.split('/').pop() || 'asset';
  }
}

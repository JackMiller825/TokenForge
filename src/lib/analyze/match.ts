import { canonicalUrl } from '../discover/urls';
import type { ManifestRef, MatchKind } from './model';

function safeCanonical(value: string): string | null {
  try {
    return canonicalUrl(value);
  } catch {
    return null;
  }
}

function pathKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.search) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function matchManifest(value: string, assets: ManifestRef[]): { id: string | null; match: MatchKind } {
  if (!value) return { id: null, match: 'none' };
  const exact = assets.find((asset) => asset.url === value || asset.sourceUrl === value || asset.resolvedUrl === value);
  if (exact) return { id: exact.id, match: 'exact' };
  const canonical = safeCanonical(value);
  if (!canonical) return { id: null, match: 'none' };
  const canonicalHits = assets.filter((asset) => [asset.url, asset.sourceUrl, asset.resolvedUrl].some((item) => item && safeCanonical(item) === canonical));
  if (canonicalHits.length === 1) return { id: canonicalHits[0].id, match: 'canonical' };
  if (canonicalHits.length > 1) return { id: null, match: 'none' };
  const path = pathKey(value);
  if (!path) return { id: null, match: 'none' };
  const pathHits = assets.filter((asset) => [asset.url, asset.sourceUrl, asset.resolvedUrl].some((item) => item && pathKey(item) === path));
  if (pathHits.length === 1) return { id: pathHits[0].id, match: 'path' };
  return { id: null, match: 'none' };
}

import { EXT_CATEGORY, extensionForMime } from '../classify/kinds';
import { basenameFromUrl, decodePart, extensionOfName, sanitizeSegment, allocateName } from '../security/filename';
import type { ZipStructure } from '../types';

const KNOWN = new Set(Object.keys(EXT_CATEGORY));

export interface PlannedName {
  originalFilename: string | null;
  savedFilename: string;
  filenameInferred: boolean;
  extension: string;
}

export function plannedFilename(resolvedUrl: string, mime: string | undefined, index: number): PlannedName {
  const original = basenameFromUrl(resolvedUrl);
  const fromName = extensionOfName(original);
  const fromMime = extensionForMime(mime);
  if (original && fromName && KNOWN.has(fromName)) {
    return { originalFilename: original, savedFilename: original, filenameInferred: false, extension: fromName };
  }
  if (original && !fromName && fromMime) {
    return { originalFilename: original, savedFilename: `${original}.${fromMime}`, filenameInferred: true, extension: fromMime };
  }
  if (original) {
    return { originalFilename: original, savedFilename: original, filenameInferred: false, extension: fromName };
  }
  const extension = fromMime || 'bin';
  return { originalFilename: null, savedFilename: `asset-${index}.${extension}`, filenameInferred: true, extension };
}

export function sourceDirectory(value: string): string {
  try {
    const url = new URL(value);
    const host = sanitizeSegment(url.hostname) || 'host';
    const parts = url.pathname.split('/').filter(Boolean);
    parts.pop();
    const dirs = parts.map((part) => sanitizeSegment(decodePart(part))).filter(Boolean);
    return [host, ...dirs].join('/');
  } catch {
    return 'remote';
  }
}

export function safeRelative(value: string): string {
  const parts = value.split('/').flatMap((part) => {
    const clean = sanitizeSegment(part);
    return clean ? [clean] : [];
  });
  let joined = parts.join('/');
  if (!joined) joined = 'files/asset.bin';
  const lower = joined.toLowerCase();
  if (lower === 'manifest.json' || lower === 'readme.md') joined = `files/${joined}`;
  return joined;
}

export function planPaths(
  assets: Array<{ id: string; category: string; savedFilename: string; resolvedUrl: string }>,
  selectedIds: Iterable<string>,
  structure: ZipStructure,
): Map<string, string> {
  const selected = new Set(selectedIds);
  const chosen = assets.filter((asset) => selected.has(asset.id)).sort((a, b) => a.id.localeCompare(b.id));
  const used = new Map<string, Set<string>>();
  const paths = new Map<string, string>();
  for (const asset of chosen) {
    const dir = structure === 'organized' ? asset.category : sourceDirectory(asset.resolvedUrl);
    const leaf = sanitizeSegment(asset.savedFilename) || 'asset.bin';
    const set = used.get(dir) ?? new Set<string>();
    used.set(dir, set);
    paths.set(asset.id, safeRelative(`${dir}/${allocateName(leaf, set)}`));
  }
  return paths;
}

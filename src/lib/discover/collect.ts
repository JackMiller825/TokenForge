import { createHash } from 'node:crypto';
import { LIMITS } from '../config';
import { plannedFilename } from '../archive/names';
import { categoryFor, extensionForMime, normalizeMime } from '../classify/kinds';
import { extensionOfUrl } from '../security/filename';
import { isObviouslyBlocked, type SecurityOptions } from '../security/network';
import { canonicalUrl } from './urls';
import { isTracker } from './trackers';
import { categoryCounts, type AssetRecord, type Category, type DiscoveryMethod } from '../types';

export function stableId(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

export class AssetCollector {
  private readonly assets = new Map<string, AssetRecord>();
  trackerSkips = 0;
  capped = false;

  constructor(private readonly options: SecurityOptions & { includeTrackers?: boolean; maxAssets?: number } = {}) {}

  add(rawUrl: string, method: DiscoveryMethod, pageUrl: string, mimeHint = '', bytes?: number): void {
    if (!rawUrl || isObviouslyBlocked(rawUrl, this.options)) return;
    if (!this.options.includeTrackers && isTracker(rawUrl)) {
      this.trackerSkips += 1;
      return;
    }
    let key = rawUrl;
    try {
      key = canonicalUrl(rawUrl);
    } catch {
      return;
    }
    const extension = extensionOfUrl(key);
    const category = categoryFor(mimeHint, extension);
    if (!category) return;
    const existing = this.assets.get(key);
    if (existing) {
      if (!existing.references.some((item) => item.pageUrl === pageUrl && item.method === method) && existing.references.length < 20) {
        existing.references.push({ pageUrl, method });
      }
      if (!existing.mimeType && mimeHint) existing.mimeType = normalizeMime(mimeHint);
      if (existing.bytes == null && bytes) existing.bytes = bytes;
      if (existing.category === 'other' && category !== 'other') existing.category = category;
      return;
    }
    if (this.assets.size >= (this.options.maxAssets ?? LIMITS.maxDiscovered)) {
      this.capped = true;
      return;
    }
    const planned = plannedFilename(key, mimeHint, this.assets.size + 1);
    const record: AssetRecord = {
      id: stableId(key),
      url: key,
      sourceUrl: rawUrl,
      resolvedUrl: key,
      originalFilename: planned.originalFilename,
      filename: planned.savedFilename,
      savedFilename: planned.savedFilename,
      filenameInferred: planned.filenameInferred,
      category,
      mimeType: normalizeMime(mimeHint) || undefined,
      extension: planned.extension || extension || extensionForMime(mimeHint) || undefined,
      bytes,
      source: method,
      discoveryMethod: method,
      references: [{ pageUrl, method }],
      status: 'pending',
    };
    this.assets.set(key, record);
  }

  list(): AssetRecord[] {
    return [...this.assets.values()].sort((a, b) => a.resolvedUrl.localeCompare(b.resolvedUrl));
  }

  counts(): Record<Category, number> {
    return categoryCounts(this.list());
  }
}

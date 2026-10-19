import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LIMITS } from '../config';
import { applyPlannedPaths, buildManifest } from '../archive/manifest';
import { writeZip } from '../archive/zip';
import { categoryFor } from '../classify/kinds';
import { imageDimensions, sniffMime } from '../classify/sniff';
import { safeFetch } from '../security/fetch';
import type { AssetRecord, AssetStatus, ManifestFile, Progress, ScanResult, StoredCookie, ZipStructure } from '../types';
import { CancelledError } from '../browser/cancel';

export interface ExportOptions {
  scan: ScanResult;
  assets: AssetRecord[];
  structure: ZipStructure;
  zipPath: string;
  workDir: string;
  signal?: AbortSignal;
  testAllowHosts?: string[];
  maxAssetBytes?: number;
  maxTotalBytes?: number;
  concurrency?: number;
  retries?: number;
  timeoutMs?: number;
  cookies?: StoredCookie[];
  onProgress?: (progress: Progress) => void;
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new CancelledError());
    };
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function transient(error: Error): boolean {
  if (error instanceof CancelledError || error.message === 'Cancelled') return false;
  if (/exceeds size limit|Private or unroutable|blocked|Invalid URL|credentials|Custom ports|Too many redirects/i.test(error.message)) return false;
  if (/HTTP 404|HTTP 400|HTTP 401|HTTP 403|HTTP 410|HTTP 451/.test(error.message)) return false;
  return /HTTP 408|HTTP 425|HTTP 429|HTTP 5|timed out|ECONNRESET|EAI_AGAIN|ETIMEDOUT|socket hang up|EPIPE/i.test(error.message);
}

async function withRetry<T>(attempts: number, signal: AbortSignal | undefined, run: () => Promise<T>): Promise<T> {
  let last: Error = new Error('Download failed');
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) throw new CancelledError();
    try {
      return await run();
    } catch (error) {
      last = error instanceof Error ? error : new Error('Download failed');
      if (error instanceof CancelledError || !transient(last) || attempt === attempts) throw last;
      await sleep(Math.min(4000, 250 * 2 ** attempt), signal);
    }
  }
  throw last;
}

function cookieHeader(target: string, cookies: StoredCookie[]): string | undefined {
  const url = new URL(target);
  const pairs = cookies.filter((cookie) => {
    const domain = cookie.domain.replace(/^\./, '').toLowerCase();
    const host = url.hostname.toLowerCase();
    return (host === domain || host.endsWith(`.${domain}`)) && url.pathname.startsWith(cookie.path || '/');
  });
  return pairs.length ? pairs.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ') : undefined;
}

async function mapPool<T>(items: T[], limit: number, signal: AbortSignal | undefined, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(limit, 1), Math.max(items.length, 1)) }, async () => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const current = items[cursor];
      cursor += 1;
      if (!current) return;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export async function exportAssets(options: ExportOptions): Promise<{ manifest: ManifestFile; bytes: number }> {
  const maxAssetBytes = options.maxAssetBytes ?? LIMITS.maxAssetBytes;
  const maxTotalBytes = options.maxTotalBytes ?? LIMITS.maxTotalBytes;
  const records: AssetRecord[] = options.assets.map((asset) => ({ ...asset, references: [...asset.references], status: 'pending' as AssetStatus, error: undefined }));
  await mkdir(options.workDir, { recursive: true });
  let downloadedBytes = 0;
  let completed = 0;
  let failed = 0;
  const report = (message: string, phase: Progress['phase'] = 'downloading') => {
    options.onProgress?.({
      phase,
      message,
      pagesScanned: options.scan.pages.length,
      pagesQueued: 0,
      assetsFound: options.scan.assets.length,
      completed,
      failed,
      total: records.length,
      bytes: downloadedBytes,
    });
  };
  report(`Downloading 0 of ${records.length}`);

  await mapPool(records, options.concurrency ?? LIMITS.downloadConcurrency, options.signal, async (asset) => {
    if (options.signal?.aborted) {
      asset.status = 'failed';
      asset.error = 'Cancelled';
      failed += 1;
      return;
    }
    const temp = join(options.workDir, `${asset.id}.bin`);
    try {
      const response = await withRetry(options.retries ?? LIMITS.downloadRetries, options.signal, () => safeFetch(asset.resolvedUrl, {
        timeoutMs: options.timeoutMs ?? LIMITS.requestTimeoutMs,
        maxBytes: maxAssetBytes,
        testAllowHosts: options.testAllowHosts,
        signal: options.signal,
        headers: cookieHeader(asset.resolvedUrl, options.cookies ?? []) ? { cookie: cookieHeader(asset.resolvedUrl, options.cookies ?? [])! } : {},
      }));
      if (downloadedBytes + response.buffer.length > maxTotalBytes) throw new Error('ZIP total limit reached');
      downloadedBytes += response.buffer.length;
      await writeFile(temp, response.buffer);
      const sniffed = sniffMime(response.buffer, response.contentType);
      asset.bytes = response.buffer.length;
      asset.contentHash = createHash('sha256').update(response.buffer).digest('hex');
      asset.mimeType = sniffed.mime || asset.mimeType;
      if (sniffed.extension) asset.extension = sniffed.extension;
      const sniffedCategory = categoryFor(sniffed.mime, sniffed.extension || asset.extension || '');
      if (sniffedCategory && (asset.filenameInferred || asset.category === 'other')) asset.category = sniffedCategory;
      if (asset.filenameInferred && sniffed.extension && !asset.savedFilename.toLowerCase().endsWith(`.${sniffed.extension}`)) {
        const stem = asset.originalFilename || asset.savedFilename.replace(/\.[a-z0-9]{1,8}$/i, '');
        asset.savedFilename = `${stem}.${sniffed.extension}`;
        asset.filename = asset.savedFilename;
      }
      if (asset.category === 'images') {
        const dimensions = imageDimensions(response.buffer);
        asset.width = dimensions.width;
        asset.height = dimensions.height;
      }
      asset.resolvedUrl = response.finalUrl || asset.resolvedUrl;
      asset.url = asset.resolvedUrl;
      asset.status = 'downloaded';
      completed += 1;
    } catch (error) {
      asset.status = 'failed';
      asset.error = error instanceof CancelledError ? 'Cancelled' : error instanceof Error ? error.message : 'Download failed';
      failed += 1;
      await rm(temp, { force: true }).catch(() => undefined);
    }
    report(`Downloading ${completed + failed} of ${records.length}`);
  });

  if (options.signal?.aborted) {
    for (const asset of records) {
      if (asset.status === 'pending') {
        asset.status = 'failed';
        asset.error = 'Cancelled';
        failed += 1;
      }
    }
  }

  const hashes = new Map<string, string>();
  for (const asset of records) {
    if (!asset.contentHash || asset.status !== 'downloaded') continue;
    const first = hashes.get(asset.contentHash);
    if (first) asset.sameContentAs = first;
    else hashes.set(asset.contentHash, asset.id);
  }

  const planned = applyPlannedPaths(records, options.structure);
  for (const asset of planned) {
    if (asset.status !== 'downloaded') asset.outputPath = undefined;
  }
  const files = [];
  for (const asset of planned) {
    if (asset.status !== 'downloaded' || !asset.outputPath) continue;
    const temp = join(options.workDir, `${asset.id}.bin`);
    try {
      await stat(temp);
      files.push({ path: asset.outputPath, file: temp });
    } catch {
      asset.status = 'failed';
      asset.error = asset.error || 'Downloaded file was missing';
    }
  }
  report('Writing the archive', 'archiving');
  const manifest = buildManifest(options.scan, planned, options.structure, options.signal?.aborted ? ['Export was cancelled. The archive contains files saved before cancellation.'] : []);
  const bytes = await writeZip(options.zipPath, files, manifest);
  await rm(options.workDir, { recursive: true, force: true });
  report('Archive ready', 'done');
  return { manifest, bytes };
}

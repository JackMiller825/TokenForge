import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { AssetCollector } from '../src/lib/discover/collect';
import { exportAssets } from '../src/lib/download/pipeline';
import { safeFetch } from '../src/lib/security/fetch';
import { PNG, startServer } from './helpers';
import type { ScanResult } from '../src/lib/types';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

function scanOf(url: string): ScanResult {
  return {
    manifestVersion: '1.0.0',
    pageUrl: url,
    finalUrl: url,
    title: 'Fixture',
    scannedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    mode: 'quick',
    pages: [url],
    warnings: [],
    assets: [],
    stats: { discovered: 0, byCategory: { images: 0, videos: 0, fonts: 0, audio: 0, styles: 0, scripts: 0, documents: 0, other: 0 } },
  };
}

describe('downloads and archives', () => {
  it('follows safe redirects, blocks private redirects, limits size, retries, and cancels', async () => {
    let flaky = 0;
    const server = await startServer((req, res) => {
      if (req.url === '/old') {
        res.writeHead(302, { location: '/images/Hero.png' });
        res.end();
        return;
      }
      if (req.url === '/images/Hero.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
        return;
      }
      if (req.url === '/evil') {
        res.writeHead(302, { location: 'http://10.1.2.3/secret' });
        res.end();
        return;
      }
      if (req.url === '/big') {
        res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': '500' });
        res.end(Buffer.alloc(500));
        return;
      }
      if (req.url === '/flaky') {
        flaky += 1;
        if (flaky === 1) {
          res.writeHead(503);
          res.end('later');
          return;
        }
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
        return;
      }
      if (req.url === '/slow') return;
      res.writeHead(404);
      res.end();
    });
    closers.push(server.close);
    const options = { testAllowHosts: ['127.0.0.1'], timeoutMs: 2000 };
    const redirected = await safeFetch(`${server.url}/old`, options);
    expect(redirected.finalUrl).toBe(`${server.url}/images/Hero.png`);
    expect(redirected.buffer.equals(PNG)).toBe(true);
    await expect(safeFetch(`${server.url}/evil`, options)).rejects.toThrow(/Private|blocked|unroutable/);
    await expect(safeFetch(`${server.url}/big`, { ...options, maxBytes: 100 })).rejects.toThrow(/size limit/);
    const retried = await exportAssets({
      scan: scanOf(server.url),
      assets: [{
        id: 'abc123abc123abcd',
        url: `${server.url}/flaky`,
        sourceUrl: `${server.url}/flaky`,
        resolvedUrl: `${server.url}/flaky`,
        originalFilename: 'flaky.png',
        filename: 'flaky.png',
        savedFilename: 'flaky.png',
        filenameInferred: false,
        category: 'images',
        extension: 'png',
        source: 'network',
        discoveryMethod: 'network',
        references: [],
        status: 'pending',
      }],
      structure: 'organized',
      zipPath: join(tmpdir(), `tokenforge-flaky-${Date.now()}.zip`),
      workDir: join(tmpdir(), `tokenforge-flaky-work-${Date.now()}`),
      testAllowHosts: ['127.0.0.1'],
      retries: 2,
      timeoutMs: 2000,
    });
    expect(retried.manifest.summary.downloaded).toBe(1);
    const controller = new AbortController();
    const pending = safeFetch(`${server.url}/slow`, { ...options, signal: controller.signal, timeoutMs: 5000 });
    setTimeout(() => controller.abort(), 30);
    await expect(pending).rejects.toThrow(/Cancelled/);
  });

  it('writes a partial archive whose bytes, names, and manifest agree', async () => {
    const server = await startServer((req, res) => {
      if (req.url === '/images/logo.png' || req.url === '/assets/logo.png' || req.url === '/media/12345') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
        return;
      }
      res.writeHead(404);
      res.end('missing');
    });
    closers.push(server.close);
    const collector = new AssetCollector({ testAllowHosts: ['127.0.0.1'] });
    collector.add(`${server.url}/images/logo.png`, 'dom', server.url);
    collector.add(`${server.url}/assets/logo.png`, 'dom', server.url);
    collector.add(`${server.url}/media/12345`, 'network', server.url, 'image/png');
    collector.add(`${server.url}/missing.png`, 'dom', server.url);
    const assets = collector.list();
    const dir = await mkdtemp(join(tmpdir(), 'tokenforge-'));
    const zipPath = join(dir, 'assets.zip');
    const outcome = await exportAssets({
      scan: { ...scanOf(server.url), assets },
      assets,
      structure: 'organized',
      zipPath,
      workDir: join(dir, 'work'),
      testAllowHosts: ['127.0.0.1'],
      retries: 0,
      timeoutMs: 4000,
    });
    const zip = await JSZip.loadAsync(await readFile(zipPath));
    const names = Object.keys(zip.files).filter((name) => !name.endsWith('/'));
    expect(names).toContain('manifest.json');
    expect(names).toContain('README.md');
    expect(names.some((name) => name.endsWith('logo.png'))).toBe(true);
    expect(names.some((name) => name.includes('logo__2.png') || name.includes('Logo__2'))).toBe(true);
    expect(names.some((name) => name.endsWith('12345.png'))).toBe(true);
    expect(names.some((name) => name.includes('..'))).toBe(false);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.manifestVersion).toBe('1.0.0');
    expect(manifest.summary.downloaded).toBe(3);
    expect(manifest.summary.failed).toBe(1);
    const failed = manifest.assets.find((asset: { status: string }) => asset.status === 'failed');
    expect(failed.error).toMatch(/HTTP 404/);
    expect(failed.resolvedUrl).toContain('/missing.png');
    const inferred = manifest.assets.find((asset: { originalFilename: string | null }) => asset.originalFilename === '12345');
    expect(inferred.filenameInferred).toBe(true);
    expect(inferred.savedFilename).toBe('12345.png');
    expect(inferred.width).toBe(1);
    expect(inferred.contentHash).toBe(createHash('sha256').update(PNG).digest('hex'));
    const fileName = inferred.outputPath as string;
    const packed = await zip.file(fileName)!.async('nodebuffer');
    expect(createHash('sha256').update(packed).digest('hex')).toBe(inferred.contentHash);
    expect(outcome.bytes).toBeGreaterThan(100);
    await rm(dir, { recursive: true, force: true });
  });
});

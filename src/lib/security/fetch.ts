import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import { assertPublicUrl, isBlockedIp, normalizeHost, type SecurityOptions } from './network';

export interface SafeFetchOptions extends SecurityOptions {
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface SafeResponse {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
  status: number;
}

export function createSafeLookup(options?: SecurityOptions): LookupFunction {
  const allow = new Set((options?.testAllowHosts ?? []).map((host) => host.toLowerCase()));
  return ((hostname: string, opts: dns.LookupOptions, callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family: number) => void) => {
    const host = normalizeHost(hostname);
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error || !addresses?.length) {
        callback(error || Object.assign(new Error('The host did not resolve'), { code: 'ENOTFOUND' }), '', 4);
        return;
      }
      if (!allow.has(host) && addresses.some((record) => isBlockedIp(record.address))) {
        callback(Object.assign(new Error('Private or unroutable network address is blocked'), { code: 'EBLOCKED' }), '', 4);
        return;
      }
      if (opts.all) {
        callback(null, addresses, addresses[0].family);
        return;
      }
      callback(null, addresses[0].address, addresses[0].family);
    });
  }) as LookupFunction;
}

function requestOnce(url: URL, options: SafeFetchOptions): Promise<{ status: number; headers: http.IncomingHttpHeaders; buffer: Buffer }> {
  const lib = url.protocol === 'https:' ? https : http;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    const req = lib.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        'user-agent': 'TokenForgeAssetBot/1.0',
        accept: '*/*',
        ...options.headers,
      },
      lookup: createSafeLookup(options),
      servername: url.hostname,
      timeout: timeoutMs,
    }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.resume();
        resolve({ status, headers: res.headers, buffer: Buffer.alloc(0) });
        return;
      }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared > maxBytes) {
        res.destroy();
        reject(new Error('Asset exceeds size limit'));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          res.destroy();
          reject(new Error('Asset exceeds size limit'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve({ status, headers: res.headers, buffer: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    const fail = (error: Error) => reject(error.name === 'AbortError' ? new Error('Cancelled') : error);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', fail);
    if (options.signal) {
      if (options.signal.aborted) {
        req.destroy(new Error('Cancelled'));
        return;
      }
      const onAbort = () => req.destroy(new Error('Cancelled'));
      options.signal.addEventListener('abort', onAbort, { once: true });
      req.on('close', () => options.signal?.removeEventListener('abort', onAbort));
    }
    req.end();
  });
}

export async function safeFetch(input: string, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  let current = input;
  for (let hop = 0; hop < 5; hop += 1) {
    if (options.signal?.aborted) throw new Error('Cancelled');
    const url = await assertPublicUrl(current, options);
    const response = await requestOnce(url, options);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location || Array.isArray(location)) throw new Error('Redirect missing location');
      current = new URL(location, current).href;
      continue;
    }
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
    const header = response.headers['content-type'];
    return {
      buffer: response.buffer,
      contentType: Array.isArray(header) ? header[0] : header || '',
      finalUrl: current,
      status: response.status,
    };
  }
  throw new Error('Too many redirects');
}

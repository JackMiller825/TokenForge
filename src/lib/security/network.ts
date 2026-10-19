import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata',
  'instance-data',
  'instance-data.ec2.internal',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.intranet', '.lan', '.home', '.corp', '.home.arpa', '.alt'];

export class UrlSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlSecurityError';
  }
}

export interface SecurityOptions {
  /** Loopback fixtures only. HTTP handlers must never set this. */
  testAllowHosts?: readonly string[];
}

export type ResolveFn = (hostname: string) => Promise<string[]>;

export function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

export function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.endsWith('.svc') || host.endsWith('.cluster.local')) return true;
  if (!host.includes('.') && !isIP(host)) return true;
  return false;
}

export function isBlockedIp(address: string): boolean {
  const host = normalizeHost(address);
  if (!ipaddr.isValid(host)) return true;
  let parsed = ipaddr.parse(host);
  if (parsed.kind() === 'ipv6') {
    const v6 = parsed as ipaddr.IPv6;
    if (v6.isIPv4MappedAddress()) parsed = v6.toIPv4Address();
  }
  return parsed.range() !== 'unicast';
}

export async function defaultResolve(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function allowed(options: SecurityOptions | undefined, host: string): boolean {
  return (options?.testAllowHosts ?? []).some((item) => item.toLowerCase() === host);
}

export async function assertPublicUrl(value: string, options?: SecurityOptions, resolve: ResolveFn = defaultResolve): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UrlSecurityError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UrlSecurityError('Only public HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new UrlSecurityError('URLs with credentials are blocked');
  const host = normalizeHost(url.hostname);
  if (!host) throw new UrlSecurityError('Invalid host');
  if (allowed(options, host)) return url;
  if (isBlockedHostname(host)) throw new UrlSecurityError('Local or internal hostnames are blocked');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  if (port !== 80 && port !== 443) throw new UrlSecurityError('Custom ports are blocked');
  const addresses = isIP(host) ? [host] : await resolve(host);
  if (!addresses.length) throw new UrlSecurityError('The host did not resolve');
  if (addresses.some((address) => isBlockedIp(address))) throw new UrlSecurityError('Private or unroutable network address is blocked');
  return url;
}

export function isObviouslyBlocked(value: string, options?: SecurityOptions): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return true;
    if (url.username || url.password) return true;
    const host = normalizeHost(url.hostname);
    if (allowed(options, host)) return false;
    if (isBlockedHostname(host)) return true;
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
    if (port !== 80 && port !== 443) return true;
    if (isIP(host) && isBlockedIp(host)) return true;
    return false;
  } catch {
    return true;
  }
}

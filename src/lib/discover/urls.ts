import { extensionOfUrl } from '../security/filename';
import type { DiscoveryMethod } from '../types';

export interface FoundRef {
  url: string;
  method: DiscoveryMethod;
}

export function resolveUrl(raw: string, base: string): string | null {
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed || /^(data|blob|javascript|about):/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

export function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  return url.href;
}

export function parseSrcset(value: string): string[] {
  return value.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
}

export function shouldCrawl(link: string, origin: string): boolean {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return false;
  }
  if (url.origin !== origin) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const ext = extensionOfUrl(url.href);
  if (ext && ext !== 'html' && ext !== 'htm' && ext !== 'php') return false;
  return true;
}

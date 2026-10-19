export function formatBytes(bytes?: number): string {
  if (bytes == null || Number.isNaN(bytes)) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function withBase(path = ''): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!path) return base;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!base || normalized === base || normalized.startsWith(`${base}/`)) return normalized;
  return `${base}${normalized}`;
}

export function linkHref(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (base && (normalized === base || normalized.startsWith(`${base}/`))) return normalized.slice(base.length) || '/';
  return normalized;
}

export const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

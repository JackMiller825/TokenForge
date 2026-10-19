import type { Category } from '../types';

export const EXT_CATEGORY: Record<string, Category> = {
  png: 'images', jpg: 'images', jpeg: 'images', gif: 'images', webp: 'images', svg: 'images', avif: 'images', ico: 'images', apng: 'images', bmp: 'images',
  mp4: 'videos', webm: 'videos', mov: 'videos', m4v: 'videos', ogv: 'videos', avi: 'videos', mkv: 'videos', m3u8: 'videos',
  woff: 'fonts', woff2: 'fonts', ttf: 'fonts', otf: 'fonts', eot: 'fonts',
  mp3: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio', flac: 'audio', m4a: 'audio', opus: 'audio',
  css: 'styles',
  js: 'scripts', mjs: 'scripts', cjs: 'scripts',
  pdf: 'documents', txt: 'documents', md: 'documents', csv: 'documents', doc: 'documents', docx: 'documents', ppt: 'documents', pptx: 'documents', xls: 'documents', xlsx: 'documents',
};

const SKIP = new Set(['html', 'htm', 'php', 'asp', 'aspx', 'json', 'xml', 'map', 'xhtml']);

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/apng': 'apng',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-woff': 'woff',
  'application/font-woff2': 'woff2',
  'application/x-font-ttf': 'ttf',
  'application/x-font-otf': 'otf',
  'application/vnd.ms-fontobject': 'eot',
  'text/css': 'css',
  'text/javascript': 'js',
  'application/javascript': 'js',
  'application/x-javascript': 'js',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
};

export function normalizeMime(value?: string): string {
  return (value || '').split(';')[0].trim().toLowerCase();
}

export function extensionForMime(value?: string): string {
  return MIME_EXT[normalizeMime(value)] || '';
}

export function categoryFor(mime: string, extension: string): Category | null {
  const ext = extension.toLowerCase().replace(/^\./, '');
  if (ext && EXT_CATEGORY[ext]) return EXT_CATEGORY[ext];
  const type = normalizeMime(mime);
  if (!type || type === 'application/octet-stream') {
    if (ext && !SKIP.has(ext)) return 'other';
    return null;
  }
  if (type === 'text/html' || type === 'application/xhtml+xml') return null;
  if (type === 'text/css') return 'styles';
  if (type.includes('javascript')) return 'scripts';
  if (type === 'application/pdf' || type === 'text/plain' || type === 'text/markdown' || type === 'text/csv') return 'documents';
  if (type.startsWith('image/')) return 'images';
  if (type.startsWith('video/')) return 'videos';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('font/') || type.includes('font')) return 'fonts';
  if (ext && !SKIP.has(ext)) return 'other';
  return null;
}

export function isPreviewable(category: Category): boolean {
  return category === 'images' || category === 'videos' || category === 'audio' || category === 'fonts';
}

import imageSize from 'image-size';
import { categoryFor, extensionForMime, normalizeMime } from './kinds';

export interface SniffedType {
  mime: string;
  extension: string;
  source: 'magic' | 'header' | 'unknown';
}

function textHead(buffer: Buffer): string {
  return buffer.subarray(0, 240).toString('utf8').trim().toLowerCase();
}

export function sniffMime(buffer: Buffer, headerMime?: string): SniffedType {
  const magic = magicMime(buffer);
  if (magic) return { ...magic, source: 'magic' };
  const header = normalizeMime(headerMime);
  const extension = extensionForMime(header);
  if (header && header !== 'application/octet-stream' && extension) return { mime: header, extension, source: 'header' };
  if (header) return { mime: header, extension: '', source: 'header' };
  return { mime: 'application/octet-stream', extension: '', source: 'unknown' };
}

function magicMime(buffer: Buffer): { mime: string; extension: string } | null {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return { mime: 'image/png', extension: 'png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return { mime: 'image/gif', extension: 'gif' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return { mime: 'audio/wav', extension: 'wav' };
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) return { mime: 'image/bmp', extension: 'bmp' };
  if (buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 0 && buffer[2] === 1 && buffer[3] === 0) return { mime: 'image/x-icon', extension: 'ico' };
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return { mime: 'application/pdf', extension: 'pdf' };
  if (buffer.subarray(0, 4).toString('ascii') === 'wOFF') return { mime: 'font/woff', extension: 'woff' };
  if (buffer.subarray(0, 4).toString('ascii') === 'wOF2') return { mime: 'font/woff2', extension: 'woff2' };
  if (buffer.subarray(0, 4).toString('ascii') === 'OTTO') return { mime: 'font/otf', extension: 'otf' };
  if (buffer.length >= 4 && buffer[0] === 0 && buffer[1] === 1 && buffer[2] === 0 && buffer[3] === 0) return { mime: 'font/ttf', extension: 'ttf' };
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return { mime: 'audio/flac', extension: 'flac' };
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return { mime: 'audio/ogg', extension: 'ogg' };
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return { mime: 'audio/mpeg', extension: 'mp3' };
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return { mime: 'image/avif', extension: 'avif' };
    if (brand === 'qt  ') return { mime: 'video/quicktime', extension: 'mov' };
    return { mime: 'video/mp4', extension: 'mp4' };
  }
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { mime: 'video/webm', extension: 'webm' };
  const head = textHead(buffer);
  if (head.includes('<svg')) return { mime: 'image/svg+xml', extension: 'svg' };
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return { mime: 'text/html', extension: 'html' };
  return null;
}

export function imageDimensions(buffer: Buffer): { width?: number; height?: number } {
  try {
    const size = imageSize(buffer);
    return {
      width: typeof size.width === 'number' ? size.width : undefined,
      height: typeof size.height === 'number' ? size.height : undefined,
    };
  } catch {
    return {};
  }
}

export function svgHasActiveContent(buffer: Buffer): boolean {
  const text = buffer.subarray(0, 200_000).toString('utf8');
  return /<script|javascript:|on[a-z]+\s*=/i.test(text);
}

export function previewMime(buffer: Buffer, headerMime: string | undefined, extension: string): string | null {
  const sniffed = sniffMime(buffer, headerMime);
  const category = categoryFor(sniffed.mime, sniffed.extension || extension);
  if (!category || !['images', 'videos', 'audio', 'fonts'].includes(category)) return null;
  if ((sniffed.mime === 'image/svg+xml' || extension === 'svg') && svgHasActiveContent(buffer)) return 'text/plain';
  return sniffed.mime || headerMime || 'application/octet-stream';
}

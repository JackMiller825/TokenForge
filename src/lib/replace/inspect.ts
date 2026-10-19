import { createHash } from 'node:crypto';
import { imageDimensions, sniffMime, svgHasActiveContent } from '../classify/sniff';
import { LIMITS } from '../config';
import type { AssetRole, TextMark } from './model';
import { aspectLabel } from './ratio';
import { inferReferenceRole } from './roles';

const ACCEPT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg', 'mp4', 'webm', 'mov', 'woff', 'woff2', 'ttf', 'otf']);

export interface InspectedFile {
  originalFilename: string;
  mimeType: string;
  extension: string;
  bytes: number;
  width?: number;
  height?: number;
  aspect?: string;
  hasAlpha?: boolean;
  animated?: boolean;
  durationSeconds?: number;
  contentHash: string;
  containsText: TextMark;
  role: AssetRole;
  roleInferred: boolean;
  roleReason: string;
}

export function sanitizeSvg(source: string): string {
  return source
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

export function inspectUpload(buffer: Buffer, originalFilename: string): InspectedFile {
  if (!buffer.length) throw new Error(`${originalFilename || 'Upload'} is empty.`);
  if (buffer.length > LIMITS.maxAssetBytes) throw new Error(`${originalFilename} is larger than the ${LIMITS.maxAssetBytes} byte limit.`);
  const sniffed = sniffMime(buffer);
  if (!ACCEPT.has(sniffed.extension)) throw new Error(`${originalFilename || 'That file'} is not an image, video, or font TokenForge can store.`);
  const declared = originalFilename.split('.').pop()?.toLowerCase() || '';
  if (declared && ACCEPT.has(declared) && declared !== sniffed.extension && !(declared === 'jpeg' && sniffed.extension === 'jpg') && !(declared === 'jpg' && sniffed.extension === 'jpeg')) {
    throw new Error(`${originalFilename} has a .${declared} name but the file signature is ${sniffed.extension}.`);
  }
  const dimensions = sniffed.mime.startsWith('image/') && sniffed.extension !== 'svg' ? imageDimensions(buffer) : {};
  const width = dimensions.width;
  const height = dimensions.height;
  if (width && height && (width > LIMITS.maxUploadEdge || height > LIMITS.maxUploadEdge || width * height > LIMITS.maxPixels)) {
    throw new Error(`${originalFilename} exceeds the pixel limit. Resize it before uploading.`);
  }
  if (sniffed.mime.startsWith('image/') && sniffed.extension !== 'svg' && (!width || !height)) {
    throw new Error(`${originalFilename} looks truncated or corrupted.`);
  }
  const roleGuess = inferReferenceRole({
    manifestAssetId: '',
    filename: originalFilename,
    category: sniffed.mime.startsWith('font/') || ['woff', 'woff2', 'ttf', 'otf'].includes(sniffed.extension) ? 'fonts' : sniffed.mime.startsWith('video/') ? 'videos' : 'images',
    url: originalFilename,
    pageUrl: '',
    sectionId: null,
    sectionRole: null,
    kind: sniffed.mime.startsWith('video/') ? 'video' : 'img',
    width,
    height,
    objectFit: '',
    objectPosition: '',
    opacity: '1',
    transform: 'none',
    borderRadius: '0',
    zIndex: 'auto',
    animated: animated(buffer, sniffed.extension),
    usage: 1,
    responsive: false,
  });
  const text = sniffed.extension === 'svg' && /<text[\s>]/i.test(buffer.subarray(0, 200_000).toString('utf8')) ? 'yes' : 'unknown';
  return {
    originalFilename: originalFilename.slice(0, 180) || `upload.${sniffed.extension}`,
    mimeType: sniffed.mime,
    extension: sniffed.extension === 'jpeg' ? 'jpg' : sniffed.extension,
    bytes: buffer.length,
    width,
    height,
    aspect: aspectLabel(width, height),
    hasAlpha: hasAlpha(buffer, sniffed.extension),
    animated: animated(buffer, sniffed.extension),
    durationSeconds: videoDuration(buffer, sniffed.extension),
    contentHash: createHash('sha256').update(buffer).digest('hex'),
    containsText: text as TextMark,
    role: roleGuess.role,
    roleInferred: true,
    roleReason: roleGuess.reason,
  };
}

function hasAlpha(buffer: Buffer, extension: string): boolean {
  if (extension === 'png' && buffer.length > 25) return buffer[25] === 4 || buffer[25] === 6;
  if (extension === 'webp') return buffer.includes(Buffer.from('ALPH')) || buffer.includes(Buffer.from('VP8X'));
  if (extension === 'svg') return true;
  if (extension === 'gif') return buffer.includes(Buffer.from([0x21, 0xf9]));
  return false;
}

function animated(buffer: Buffer, extension: string): boolean {
  if (extension === 'gif') {
    let frames = 0;
    for (let index = 0; index < buffer.length - 1; index += 1) {
      if (buffer[index] === 0x21 && buffer[index + 1] === 0xf9) frames += 1;
      if (frames > 1) return true;
    }
  }
  if (extension === 'webp' || extension === 'png') return buffer.includes(Buffer.from('ANIM')) || buffer.includes(Buffer.from('acTL'));
  return extension === 'mp4' || extension === 'webm' || extension === 'mov';
}

function videoDuration(buffer: Buffer, extension: string): number | undefined {
  if (extension !== 'mp4' && extension !== 'mov') return undefined;
  const marker = Buffer.from('mvhd');
  const at = buffer.indexOf(marker);
  if (at < 0 || at + 20 >= buffer.length) return undefined;
  const version = buffer[at + 4];
  if (version !== 0) return undefined;
  const timescale = buffer.readUInt32BE(at + 16);
  const duration = buffer.readUInt32BE(at + 20);
  if (!timescale) return undefined;
  return Math.round((duration / timescale) * 100) / 100;
}

export function svgPreview(buffer: Buffer): { body: Buffer; mime: string } {
  if (!svgHasActiveContent(buffer)) return { body: buffer, mime: 'image/svg+xml' };
  return { body: Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8'), mime: 'image/svg+xml' };
}

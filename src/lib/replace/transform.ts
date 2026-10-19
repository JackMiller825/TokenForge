import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { LIMITS } from '../config';
import type { BrandPreset } from './model';

export interface TransformRequest {
  width: number;
  height: number;
  fit: BrandPreset['fit'];
  format: BrandPreset['format'];
  focalX?: number;
  focalY?: number;
  quality?: number;
  presetId?: string;
}

export interface TransformResult {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
  bytes: number;
  contentHash: string;
  operation: string;
  warnings: string[];
}

const CIRCLE = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="SIZE" height="SIZE"><circle cx="HALF" cy="HALF" r="HALF" fill="#fff"/></svg>`);

export async function renderVariant(input: Buffer, request: TransformRequest): Promise<TransformResult> {
  const width = Math.round(request.width);
  const height = Math.round(request.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > LIMITS.maxUploadEdge || height > LIMITS.maxUploadEdge) {
    throw new Error('Those output dimensions are outside the allowed range.');
  }
  if (width * height > LIMITS.maxPixels) throw new Error('That output is larger than the pixel limit.');
  const warnings: string[] = [];
  const meta = await sharp(input, { limitInputPixels: LIMITS.maxPixels, animated: false }).metadata();
  if ((meta.width || 0) * (meta.height || 0) > LIMITS.maxPixels) throw new Error('The source image exceeds the pixel limit.');
  const focalX = clamp(request.focalX ?? 0.5);
  const focalY = clamp(request.focalY ?? 0.5);
  let pipeline = sharp(input, { limitInputPixels: LIMITS.maxPixels, animated: false }).rotate();
  if (request.fit === 'circle' || request.fit === 'contain') {
    pipeline = pipeline.resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      position: sharp.strategy.attention,
    });
  } else {
    pipeline = coverWithFocal(pipeline, meta.width || width, meta.height || height, width, height, focalX, focalY);
  }
  if (request.fit === 'circle') {
    const size = Math.max(width, height);
    const mask = CIRCLE.toString('utf8').replaceAll('SIZE', String(size)).replaceAll('HALF', String(size / 2));
    pipeline = pipeline.ensureAlpha().composite([{ input: Buffer.from(mask), blend: 'dest-in' }]);
    warnings.push('Circular crop keeps the center of the fitted image. Check that the mascot and any lettering are still visible.');
  }
  const quality = Math.min(100, Math.max(40, Math.round(request.quality ?? 82)));
  let mimeType = 'image/png';
  let extension = 'png';
  if (request.format === 'jpeg') {
    pipeline = pipeline.flatten({ background: '#ffffff' }).jpeg({ quality });
    mimeType = 'image/jpeg';
    extension = 'jpg';
    if (meta.hasAlpha) warnings.push('JPEG cannot keep transparency, so the transparent area was flattened onto white.');
  } else if (request.format === 'webp') {
    pipeline = pipeline.webp({ quality });
    mimeType = 'image/webp';
    extension = 'webp';
  } else {
    pipeline = pipeline.png();
  }
  if (meta.pages && meta.pages > 1) warnings.push('Animation was not reproduced. This variant is a still frame.');
  const buffer = await pipeline.toBuffer();
  const out = await sharp(buffer).metadata();
  return {
    buffer,
    mimeType,
    extension,
    width: out.width || width,
    height: out.height || height,
    bytes: buffer.length,
    contentHash: createHash('sha256').update(buffer).digest('hex'),
    operation: `${request.fit} ${width}x${height} ${request.format}${request.presetId ? ` preset:${request.presetId}` : ''}`,
    warnings,
  };
}

function coverWithFocal(pipeline: ReturnType<typeof sharp>, sourceWidth: number, sourceHeight: number, width: number, height: number, focalX: number, focalY: number): ReturnType<typeof sharp> {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = Math.max(width, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(height, Math.round(sourceHeight * scale));
  const left = clampIndex(Math.round(focalX * scaledWidth - width / 2), scaledWidth - width);
  const top = clampIndex(Math.round(focalY * scaledHeight - height / 2), scaledHeight - height);
  return pipeline.resize(scaledWidth, scaledHeight, { fit: 'fill' }).extract({ left, top, width, height });
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function clampIndex(value: number, max: number): number {
  return Math.min(Math.max(0, max), Math.max(0, value));
}

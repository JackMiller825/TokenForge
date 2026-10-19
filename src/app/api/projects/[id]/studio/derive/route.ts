import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { projects } from '@/lib/projects/store';
import { openProjectStudio, presentStudio, saveProjectStudio, writeStudioFile } from '@/lib/replace/disk';
import { rememberDerived } from '@/lib/replace/studio';
import { renderVariant } from '@/lib/replace/transform';
import type { BrandPreset, DerivedAsset } from '@/lib/replace/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'derive');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const opened = openProjectStudio(store, id);
    if (!opened) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    if (opened.project.demo) throw new HttpError(400, 'Demo projects cannot be edited.');
    const body = await request.json() as { uploadId?: string; manifestAssetId?: string; presetId?: string; width?: number; height?: number; fit?: BrandPreset['fit']; format?: BrandPreset['format']; focalX?: number; focalY?: number };
    const upload = opened.studio.uploads.find((item) => item.id === body.uploadId);
    if (!upload) throw new HttpError(404, 'Upload not found');
    if (!upload.mimeType.startsWith('image/') || upload.extension === 'svg') throw new HttpError(400, 'Variants are created from raster images. SVG, video, and font files stay as uploaded.');
    const preset = body.presetId ? opened.studio.presets.find((item) => item.id === body.presetId) : undefined;
    const rendered = await renderVariant(readFileSync(join(opened.dir, upload.relativePath)), {
      width: body.width || preset?.width || upload.width || 1024,
      height: body.height || preset?.height || upload.height || 1024,
      fit: body.fit || preset?.fit || 'contain',
      format: body.format || preset?.format || 'png',
      focalX: body.focalX,
      focalY: body.focalY,
      presetId: preset?.id,
    });
    const derived: DerivedAsset = {
      id: randomUUID(),
      sourceUploadId: upload.id,
      relativePath: '',
      operation: rendered.operation,
      width: rendered.width,
      height: rendered.height,
      mimeType: rendered.mimeType,
      bytes: rendered.bytes,
      contentHash: rendered.contentHash,
      focalX: body.focalX,
      focalY: body.focalY,
      presetId: preset?.id,
      warnings: rendered.warnings,
      createdAt: new Date().toISOString(),
    };
    derived.relativePath = `studio/derived/${derived.id}.${rendered.extension}`;
    writeStudioFile(opened.dir, derived.relativePath, rendered.buffer);
    const studio = rememberDerived(opened.studio, derived, body.manifestAssetId);
    saveProjectStudio(store, id, studio, opened.scan, opened.analysis);
    return cors(request, NextResponse.json({ ...presentStudio(store, id), derived }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Variant failed' }, { status }));
  }
}

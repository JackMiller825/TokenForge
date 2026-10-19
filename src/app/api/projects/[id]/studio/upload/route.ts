import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { LIMITS } from '@/lib/config';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { projects } from '@/lib/projects/store';
import { openProjectStudio, presentStudio, saveProjectStudio, writeStudioFile } from '@/lib/replace/disk';
import { inspectUpload } from '@/lib/replace/inspect';
import { rememberUpload } from '@/lib/replace/studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'upload');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const opened = openProjectStudio(store, id);
    if (!opened) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    if (opened.project.demo) throw new HttpError(400, 'Demo projects cannot be edited.');
    const form = await request.formData();
    const files = form.getAll('file').filter((item): item is File => item instanceof File);
    if (!files.length) throw new HttpError(400, 'Choose at least one file.');
    if (opened.studio.uploads.length + files.length > LIMITS.maxUploads) throw new HttpError(400, 'This project has reached the upload limit.');
    let studio = opened.studio;
    const stored = [];
    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const inspected = inspectUpload(bytes, file.name || 'upload');
      const saved = rememberUpload(studio, inspected, randomUUID());
      studio = saved.studio;
      if (!saved.reused) writeStudioFile(opened.dir, saved.upload.relativePath, bytes);
      stored.push({ id: saved.upload.id, filename: saved.upload.originalFilename, reused: saved.reused });
    }
    saveProjectStudio(store, id, studio, opened.scan, opened.analysis);
    return cors(request, NextResponse.json({ ...presentStudio(store, id), stored }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status }));
  }
}

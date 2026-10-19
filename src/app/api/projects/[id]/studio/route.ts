import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { projects } from '@/lib/projects/store';
import { catalogFrom } from '@/lib/replace/catalog';
import { openProjectStudio, presentStudio, saveProjectStudio } from '@/lib/replace/disk';
import { applyStudioAction, type StudioAction } from '@/lib/replace/studio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const body = presentStudio(projects(), id);
    if (!body) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    return cors(request, NextResponse.json(body));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Studio failed' }, { status: 400 }));
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'upload');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const opened = openProjectStudio(store, id);
    if (!opened) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    if (opened.project.demo) throw new HttpError(400, 'Demo projects cannot be edited.');
    const action = await request.json() as StudioAction;
    const studio = applyStudioAction(opened.studio, catalogFrom(opened.scan, opened.analysis), action);
    saveProjectStudio(store, id, studio, opened.scan, opened.analysis);
    return cors(request, NextResponse.json(presentStudio(store, id)));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Studio update failed' }, { status }));
  }
}

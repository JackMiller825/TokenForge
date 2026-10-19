import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { projects } from '@/lib/projects/store';
import { assertPublicUrl } from '@/lib/security/network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  return cors(request, NextResponse.json({ projects: projects().list() }));
}

export async function POST(request: Request) {
  const blocked = authorize(request, 'scan');
  if (blocked) return blocked;
  try {
    const body = await request.json() as { name?: string; url?: string };
    if (!body.url) throw new HttpError(400, 'A URL is required');
    const url = await assertPublicUrl(body.url);
    const project = projects().create({ name: body.name || url.hostname, url: url.href });
    return cors(request, NextResponse.json(project, { status: 201 }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create the project' }, { status }));
  }
}

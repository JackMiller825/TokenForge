import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { startBlueprint } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'export');
  if (blocked) return blocked;
  try {
    const { id } = await context.params;
    const job = startBlueprint(id);
    return cors(request, NextResponse.json({ jobId: job.id, projectId: job.projectId, status: job.status }, { status: 202 }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Blueprint export failed' }, { status }));
  }
}

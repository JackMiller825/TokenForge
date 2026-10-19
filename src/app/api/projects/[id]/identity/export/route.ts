import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { startIdentityExport } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'export');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const job = startIdentityExport(id);
    return cors(request, NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 202 }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed' }, { status }));
  }
}

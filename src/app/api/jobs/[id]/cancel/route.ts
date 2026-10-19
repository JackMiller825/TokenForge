import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { cancelJob } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'scan');
  if (blocked) return blocked;
  const { id } = await context.params;
  const job = cancelJob(id);
  if (!job) return cors(request, NextResponse.json({ error: 'Job not found' }, { status: 404 }));
  return cors(request, NextResponse.json(job));
}

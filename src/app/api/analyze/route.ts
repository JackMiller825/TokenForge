import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { parseAnalyzeInput } from '@/lib/jobs/input';
import { startAnalyze } from '@/lib/jobs/manager';
import { assertPublicUrl } from '@/lib/security/network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  const blocked = authorize(request, 'analyze');
  if (blocked) return blocked;
  try {
    const input = parseAnalyzeInput(await request.json());
    if (input.url) await assertPublicUrl(input.url);
    const job = startAnalyze(input);
    return cors(request, NextResponse.json({ jobId: job.id, projectId: job.projectId, status: job.status, progress: job.progress }, { status: 202 }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed' }, { status }));
  }
}

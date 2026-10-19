import { NextResponse } from 'next/server';
import { assertPublicUrl } from '@/lib/security/network';
import { authorize } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { parseScanInput } from '@/lib/jobs/input';
import { startScan } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = authorize(request, 'scan');
  if (blocked) return blocked;
  try {
    const input = parseScanInput(await request.json());
    await assertPublicUrl(input.url);
    const job = startScan(input);
    return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 202 });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Scan failed' }, { status });
  }
}

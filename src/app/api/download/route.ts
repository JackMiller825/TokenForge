import { NextResponse } from 'next/server';
import { authorize } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { parseExportInput } from '@/lib/jobs/input';
import { startExport } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const blocked = authorize(request, 'export');
  if (blocked) return blocked;
  try {
    const input = parseExportInput(await request.json());
    const job = startExport(input.jobId, input.selectedIds, input.structure);
    return NextResponse.json({ jobId: job.id, status: job.status, progress: job.progress }, { status: 202 });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Export failed' }, { status });
  }
}

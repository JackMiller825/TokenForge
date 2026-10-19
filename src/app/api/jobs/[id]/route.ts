import { NextResponse } from 'next/server';
import { authorize } from '@/lib/http/guard';
import { getJob } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json(job);
}

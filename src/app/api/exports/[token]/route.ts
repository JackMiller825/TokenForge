import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { authorize } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { exportFile, verifyExport } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const blocked = authorize(request, 'export', { auth: false, sameSite: true });
  if (blocked) return blocked;
  try {
    const { token } = await context.params;
    const { id } = verifyExport(decodeURIComponent(token));
    const file = exportFile(id);
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(info.size),
        'Content-Disposition': 'attachment; filename="tokenforge-assets.zip"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 404;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Download unavailable' }, { status });
  }
}

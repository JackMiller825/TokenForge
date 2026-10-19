import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { exportFile, getJob, verifyExport } from '@/lib/jobs/manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const blocked = authorize(request, 'export', { auth: false });
  if (blocked) return blocked;
  try {
    const { token } = await context.params;
    const { id } = verifyExport(decodeURIComponent(token));
    const file = exportFile(id);
    const info = await stat(file);
    const stream = Readable.toWeb(createReadStream(file)) as ReadableStream;
    const filename = getJob(id)?.download?.filename || 'tokenforge-assets.zip';
    return cors(request, new Response(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(info.size),
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 404;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Download unavailable' }, { status }));
  }
}

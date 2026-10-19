import { NextResponse } from 'next/server';
import { LIMITS } from '@/lib/config';
import { previewMime } from '@/lib/classify/sniff';
import { isPreviewable } from '@/lib/classify/kinds';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { cookiesFor, getJob } from '@/lib/jobs/manager';
import { safeFetch } from '@/lib/security/fetch';
import { sanitizeSegment } from '@/lib/security/filename';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request) {
  const blocked = authorize(request, 'preview', { auth: false });
  if (blocked) return blocked;
  const url = new URL(request.url);
  const job = getJob(url.searchParams.get('jobId') || '');
  const asset = job?.result?.assets.find((item) => item.id === url.searchParams.get('assetId'));
  if (!job || !asset) return cors(request, NextResponse.json({ error: 'Asset not found' }, { status: 404 }));
  if (!isPreviewable(asset.category)) return cors(request, NextResponse.json({ error: 'This file type is not previewed' }, { status: 415 }));
  try {
    const assetUrl = new URL(asset.resolvedUrl);
    const cookies = cookiesFor(job.id).filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, '').toLowerCase();
      const host = assetUrl.hostname.toLowerCase();
      return (host === domain || host.endsWith(`.${domain}`)) && assetUrl.pathname.startsWith(cookie.path || '/');
    });
    const headers: Record<string, string> = {};
    if (cookies.length) headers.cookie = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
    const file = await safeFetch(asset.resolvedUrl, { maxBytes: LIMITS.previewMaxBytes, timeoutMs: LIMITS.requestTimeoutMs, headers });
    const mime = previewMime(file.buffer, file.contentType, asset.extension || '');
    if (!mime) return cors(request, NextResponse.json({ error: 'Preview blocked for this content type' }, { status: 415 }));
    const filename = sanitizeSegment(asset.savedFilename) || 'asset';
    return cors(request, new Response(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(file.buffer.length),
        'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Referrer-Policy': 'no-referrer',
      },
    }));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Preview failed' }, { status: 502 }));
  }
}

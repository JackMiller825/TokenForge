import { readFileSync } from 'node:fs';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { projects } from '@/lib/projects/store';
import { svgPreview } from '@/lib/replace/inspect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'preview', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  const relative = new URL(request.url).searchParams.get('path') || '';
  try {
    const file = projects().file(id, relative);
    if (!file) return cors(request, new Response('Not found', { status: 404 }));
    const bytes = readFileSync(file);
    const extension = relative.split('.').pop()?.toLowerCase() || '';
    const svg = extension === 'svg' ? svgPreview(bytes) : null;
    const type = svg?.mime || MIME[extension] || 'application/octet-stream';
    const body = svg?.body ?? bytes;
    return cors(request, new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
      },
    }));
  } catch {
    return cors(request, new Response('Not found', { status: 404 }));
  }
}

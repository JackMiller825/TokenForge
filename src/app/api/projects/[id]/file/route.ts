import { readFileSync } from 'node:fs';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { projects } from '@/lib/projects/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    return cors(request, new Response(readFileSync(file), {
      headers: {
        'Content-Type': 'image/png',
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

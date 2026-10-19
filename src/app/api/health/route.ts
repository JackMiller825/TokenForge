import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    module: '01-reference-assets',
    version: APP_VERSION,
    authRequired: Boolean(process.env.TOKENFORGE_AUTH_TOKEN),
  });
}

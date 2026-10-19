import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/config';
import { cors, preflight } from '@/lib/http/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export function GET(request: Request) {
  return cors(request, NextResponse.json({
    ok: true,
    module: '02-reference-analyzer',
    modules: ['01-reference-assets', '02-reference-analyzer'],
    version: APP_VERSION,
    authRequired: Boolean(process.env.TOKENFORGE_AUTH_TOKEN),
    capabilities: ['scan', 'analyze', 'projects', 'blueprint'],
  }));
}

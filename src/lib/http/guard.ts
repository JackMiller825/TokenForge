import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { HttpError } from './errors';

const buckets = new Map<string, { tokens: number; updated: number }>();

const RATES = { scan: 8, export: 8, preview: 120, read: 180 } as const;

function clientKey(request: Request): string {
  if (process.env.TOKENFORGE_TRUST_PROXY === '1') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]?.trim().slice(0, 80) || 'global';
  }
  return 'global';
}

export function consumeRate(key: string, limit: number, now = Date.now()): boolean {
  const windowMs = 60_000;
  const current = buckets.get(key) ?? { tokens: limit, updated: now };
  const refill = ((now - current.updated) / windowMs) * limit;
  current.tokens = Math.min(limit, current.tokens + refill);
  current.updated = now;
  if (current.tokens < 1) {
    buckets.set(key, current);
    return false;
  }
  current.tokens -= 1;
  buckets.set(key, current);
  return true;
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertAuthorized(request: Request) {
  const required = process.env.TOKENFORGE_AUTH_TOKEN;
  if (!required) return;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-tokenforge-token') || '';
  if (!token || !sameSecret(token, required)) throw new HttpError(401, 'Authentication required');
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('host');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError(403, 'Cross-origin request blocked');
  }
  if (!host || originHost !== host) throw new HttpError(403, 'Cross-origin request blocked');
}

export function assertSameSite(request: Request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Cross-site request blocked');
}

export function authorize(request: Request, bucket: keyof typeof RATES, options: { auth?: boolean; sameSite?: boolean } = {}): NextResponse | null {
  try {
    assertSameOrigin(request);
    if (options.sameSite) assertSameSite(request);
    if (options.auth !== false) assertAuthorized(request);
    if (!consumeRate(`${bucket}:${clientKey(request)}`, RATES[bucket])) throw new HttpError(429, 'Too many requests. Wait a minute and try again.');
    return null;
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Request blocked' }, { status });
  }
}

import { LIMITS, MODE_DEFAULTS } from '../config';
import { HttpError } from '../http/errors';
import type { ScanInput, ScanMode, ZipStructure } from '../types';

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function parseScanInput(body: unknown): ScanInput {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request');
  const value = body as Record<string, unknown>;
  if (typeof value.url !== 'string' || value.url.trim().length < 4 || value.url.length > 2048) {
    throw new HttpError(400, 'Enter a valid public http(s) URL');
  }
  let parsed: URL;
  try {
    parsed = new URL(value.url.trim());
  } catch {
    throw new HttpError(400, 'Enter a valid public http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new HttpError(400, 'Enter a valid public http(s) URL');
  const mode: ScanMode = value.mode === 'deep' || value.mode === 'full' ? value.mode : 'quick';
  const defaults = MODE_DEFAULTS[mode];
  return {
    url: parsed.href,
    mode,
    maxPages: mode === 'quick' ? 1 : clamp(value.maxPages, defaults.maxPages, 1, LIMITS.maxPagesCap),
    maxDepth: mode === 'quick' ? 0 : clamp(value.maxDepth, defaults.maxDepth, 0, LIMITS.maxDepthCap),
    includeTrackers: value.includeTrackers === true,
  };
}

export function parseExportInput(body: unknown): { jobId: string; selectedIds: string[]; structure: ZipStructure } {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Invalid request');
  const value = body as Record<string, unknown>;
  if (typeof value.jobId !== 'string' || !/^[a-zA-Z0-9-]{10,80}$/.test(value.jobId)) throw new HttpError(400, 'Missing scan job');
  if (!Array.isArray(value.selectedIds) || value.selectedIds.length === 0 || value.selectedIds.length > LIMITS.maxExport) {
    throw new HttpError(400, `Select between 1 and ${LIMITS.maxExport} assets`);
  }
  const selectedIds = value.selectedIds.filter((id): id is string => typeof id === 'string' && /^[a-f0-9]{16}$/.test(id));
  if (!selectedIds.length) throw new HttpError(400, 'Select at least one asset from this scan');
  const structure: ZipStructure = value.structure === 'source' ? 'source' : 'organized';
  return { jobId: value.jobId, selectedIds, structure };
}

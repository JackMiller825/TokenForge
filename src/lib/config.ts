export const APP_VERSION = '2.0.0';

export const LIMITS = {
  maxAssetBytes: positiveInt(process.env.TOKENFORGE_MAX_ASSET_BYTES, 25 * 1024 * 1024),
  maxTotalBytes: positiveInt(process.env.TOKENFORGE_MAX_TOTAL_BYTES, 160 * 1024 * 1024),
  maxDiscovered: 700,
  maxExport: 250,
  downloadConcurrency: 4,
  downloadRetries: 3,
  requestTimeoutMs: 15_000,
  previewMaxBytes: 8 * 1024 * 1024,
  exportTtlMs: 15 * 60 * 1000,
  cssMaxBytes: 1_500_000,
  maxStylesheets: 20,
  maxPagesCap: 12,
  maxDepthCap: 3,
  maxFullPageHeight: 12_000,
  maxSectionShots: 12,
  analysisSettleMs: 500,
  maxBrowsers: 1,
} as const;

export const MODE_DEFAULTS = {
  quick: { maxPages: 1, maxDepth: 0, scrolls: 5, interactions: 0, budgetMs: 45_000 },
  deep: { maxPages: 6, maxDepth: 2, scrolls: 2, interactions: 0, budgetMs: 120_000 },
  full: { maxPages: 3, maxDepth: 1, scrolls: 8, interactions: 8, budgetMs: 90_000 },
} as const;

export function dataDir(): string {
  return process.env.TOKENFORGE_DATA_DIR || '.data';
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

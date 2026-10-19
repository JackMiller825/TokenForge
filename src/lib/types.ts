export type Category = 'images' | 'videos' | 'fonts' | 'audio' | 'styles' | 'scripts' | 'documents' | 'other';
export type ScanMode = 'quick' | 'deep' | 'full';
export type ZipStructure = 'organized' | 'source';
export type DiscoveryMethod = 'network' | 'dom' | 'srcset' | 'css' | 'computed-style' | 'interaction' | 'preload' | 'icon';
export type AssetStatus = 'pending' | 'downloaded' | 'failed' | 'skipped';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AssetReference {
  pageUrl: string;
  method: DiscoveryMethod;
}

export interface AssetRecord {
  id: string;
  url: string;
  sourceUrl: string;
  resolvedUrl: string;
  originalFilename: string | null;
  filename: string;
  savedFilename: string;
  filenameInferred: boolean;
  outputPath?: string;
  category: Category;
  mimeType?: string;
  extension?: string;
  bytes?: number;
  width?: number;
  height?: number;
  contentHash?: string;
  sameContentAs?: string;
  source: string;
  discoveryMethod: DiscoveryMethod;
  references: AssetReference[];
  status?: AssetStatus;
  error?: string;
}

export interface ScanResult {
  manifestVersion: '1.0.0';
  pageUrl: string;
  finalUrl: string;
  title: string;
  scannedAt: string;
  completedAt: string;
  mode: ScanMode;
  pages: string[];
  warnings: string[];
  assets: AssetRecord[];
  stats: { discovered: number; byCategory: Record<Category, number> };
}

export interface ManifestFile {
  manifestVersion: '1.0.0';
  generator: string;
  module: '01-reference-assets';
  pageUrl: string;
  title: string;
  scannedAt: string;
  completedAt: string;
  exportedAt: string;
  site: {
    requestedUrl: string;
    finalUrl: string;
    title: string;
    mode: ScanMode;
    pages: string[];
  };
  structure: ZipStructure;
  warnings: string[];
  summary: {
    discovered: number;
    selected: number;
    downloaded: number;
    failed: number;
    skipped: number;
    bytes: number;
  };
  assets: AssetRecord[];
  modules: {
    websiteAnalyzer: null;
    assetReplacementStudio: null;
    tokenIdentityStudio: null;
    websiteGenerator: null;
    visualComparison: null;
  };
}

export interface Progress {
  phase: 'queued' | 'launching' | 'loading' | 'crawling' | 'extracting' | 'finalizing' | 'downloading' | 'archiving' | 'done' | 'initializing' | 'rendering-desktop' | 'discovering-sections' | 'mapping-assets' | 'extracting-tokens' | 'inspecting-interactions' | 'rendering-responsive' | 'generating-screenshots' | 'validating';
  message: string;
  currentUrl?: string;
  pagesScanned: number;
  pagesQueued: number;
  assetsFound: number;
  completed: number;
  failed: number;
  total: number;
  bytes: number;
  elapsedMs?: number;
  stage?: number;
  stageTotal?: number;
}

export interface ScanInput {
  url: string;
  mode: ScanMode;
  maxPages: number;
  maxDepth: number;
  includeTrackers: boolean;
  testAllowHosts?: string[];
}

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

export interface Job {
  id: string;
  type: 'scan' | 'export' | 'analyze' | 'blueprint' | 'replacement';
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  progress: Progress;
  error?: string;
  projectId?: string;
  scanInput?: Omit<ScanInput, 'testAllowHosts'>;
  result?: ScanResult;
  manifest?: ManifestFile;
  download?: { token: string; expiresAt: string; bytes: number; filename: string };
}

export const CATEGORIES: Category[] = ['images', 'videos', 'fonts', 'audio', 'styles', 'scripts', 'documents', 'other'];

export function emptyProgress(message = 'Waiting'): Progress {
  return {
    phase: 'queued',
    message,
    pagesScanned: 0,
    pagesQueued: 0,
    assetsFound: 0,
    completed: 0,
    failed: 0,
    total: 0,
    bytes: 0,
  };
}

export function categoryCounts(assets: AssetRecord[]): Record<Category, number> {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0])) as Record<Category, number>;
  for (const asset of assets) counts[asset.category] += 1;
  return counts;
}

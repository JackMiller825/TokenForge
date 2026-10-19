export const REPLACEMENT_SCHEMA = '3.0.0' as const;

export const ASSET_ROLES = [
  'main-mascot',
  'secondary-character',
  'logo',
  'hero-banner',
  'telegram-banner',
  'background',
  'section-artwork',
  'decorative',
  'icon',
  'social-icon',
  'animated-gif',
  'video-background',
  'video-poster',
  'font',
  'other',
] as const;

export type AssetRole = (typeof ASSET_ROLES)[number];
export type MappingState = 'not-mapped' | 'suggested' | 'mapped' | 'needs-review' | 'approved' | 'rejected';
export type ScopeDecision = 'replace' | 'preserve' | 'omit' | 'not-applicable';
export type PlacementAction = 'use-upload' | 'dedicated-scene' | 'derived-variant' | 'custom-artwork' | 'preserve-original';
export type TextMark = 'unknown' | 'yes' | 'no';

export interface SafeZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UploadedAsset {
  id: string;
  originalFilename: string;
  relativePath: string;
  mimeType: string;
  extension: string;
  bytes: number;
  width?: number;
  height?: number;
  aspect?: string;
  hasAlpha?: boolean;
  animated?: boolean;
  durationSeconds?: number;
  contentHash: string;
  containsText: TextMark;
  safeZone?: SafeZone;
  createdAt: string;
  role: AssetRole;
  roleInferred: boolean;
  reusedFrom?: string;
}

export interface DerivedAsset {
  id: string;
  sourceUploadId: string;
  relativePath: string;
  operation: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  contentHash: string;
  focalX?: number;
  focalY?: number;
  presetId?: string;
  warnings: string[];
  createdAt: string;
}

export interface ReferenceRole {
  manifestAssetId: string;
  role: AssetRole;
  roleInferred: boolean;
  confidence: number;
  reason: string;
  containsText: TextMark;
  scope: ScopeDecision;
}

export interface PlacementOverride {
  objectFit?: 'contain' | 'cover' | 'fill';
  objectPosition?: string;
  focalX?: number;
  focalY?: number;
}

export interface MappingRecord {
  id: string;
  manifestAssetId: string;
  uploadId: string | null;
  derivedId: string | null;
  state: MappingState;
  confidence: number;
  explanation: string;
  placement: PlacementAction;
  overrides: PlacementOverride;
  revision: number;
  updatedAt: string;
}

export interface HistoryEntry {
  at: string;
  action: string;
  detail: string;
}

export interface StudioSlice {
  roles: ReferenceRole[];
  mappings: MappingRecord[];
  uploads: UploadedAsset[];
  derived: DerivedAsset[];
  mascotUploadId: string | null;
}

export interface BrandPreset {
  id: string;
  name: string;
  width: number;
  height: number;
  fit: 'contain' | 'cover' | 'circle';
  format: 'png' | 'webp' | 'jpeg';
}

export interface StudioDocument {
  schemaVersion: '3.0.0';
  projectId: string;
  updatedAt: string;
  demo: boolean;
  roles: ReferenceRole[];
  uploads: UploadedAsset[];
  derived: DerivedAsset[];
  mappings: MappingRecord[];
  history: HistoryEntry[];
  undo: StudioSlice[];
  redo: StudioSlice[];
  presets: BrandPreset[];
  mascotUploadId: string | null;
}

export interface CatalogItem {
  manifestAssetId: string;
  filename: string;
  category: string;
  url: string;
  pageUrl: string;
  sectionId: string | null;
  sectionRole: string | null;
  kind: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  displayedWidth?: number;
  displayedHeight?: number;
  objectFit: string;
  objectPosition: string;
  opacity: string;
  transform: string;
  borderRadius: string;
  zIndex: string;
  animated: boolean;
  usage: number;
  responsive: boolean;
}

export const DEFAULT_PRESETS: BrandPreset[] = [
  { id: 'circular-logo', name: 'Circular logo', width: 1024, height: 1024, fit: 'circle', format: 'png' },
  { id: 'website-banner', name: 'Website banner', width: 1500, height: 500, fit: 'cover', format: 'png' },
  { id: 'telegram-banner', name: 'Telegram banner', width: 1100, height: 520, fit: 'cover', format: 'png' },
  { id: 'square-mascot', name: 'Square mascot', width: 1024, height: 1024, fit: 'contain', format: 'png' },
  { id: 'social-share', name: 'Social sharing image', width: 1200, height: 630, fit: 'cover', format: 'png' },
];

export function emptyStudio(projectId: string, demo = false): StudioDocument {
  return {
    schemaVersion: '3.0.0',
    projectId,
    updatedAt: new Date().toISOString(),
    demo,
    roles: [],
    uploads: [],
    derived: [],
    mappings: [],
    history: [],
    undo: [],
    redo: [],
    presets: DEFAULT_PRESETS.map((preset) => ({ ...preset })),
    mascotUploadId: null,
  };
}

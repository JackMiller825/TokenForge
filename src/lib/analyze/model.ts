import type { AssetRecord } from '../types';

export const BLUEPRINT_SCHEMA = '2.0.0';

export type SectionRole = 'header' | 'navigation' | 'hero' | 'content' | 'gallery' | 'panel' | 'token' | 'community' | 'footer' | 'sticky' | 'unknown';
export type AssetKind = 'img' | 'video' | 'poster' | 'background' | 'svg' | 'other';
export type MatchKind = 'exact' | 'canonical' | 'path' | 'none';

export interface ViewportPreset {
  id: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export const VIEWPORTS: ViewportPreset[] = [
  { id: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { id: 'tablet', width: 768, height: 1024, deviceScaleFactor: 1 },
  { id: 'mobile', width: 390, height: 844, deviceScaleFactor: 1 },
];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenshotRecord {
  id: string;
  viewport: string;
  kind: 'viewport' | 'full-page' | 'section';
  sectionId?: string;
  file: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  partial: boolean;
  note?: string;
}

export interface SectionRecord {
  id: string;
  role: SectionRole | string;
  roleInferred: boolean;
  name: string;
  confidence: number;
  selector: string;
  alternateSelector: string;
  viewport: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: string;
  padding: string;
  margin: string;
  display: string;
  layout: string;
  headings: string[];
  textSample: string;
  assetIds: string[];
  interactiveCount: number;
  overlapping: boolean;
  position: string;
  corrected: boolean;
}

export interface DesignColor {
  value: string;
  count: number;
  roles: string[];
  declared: boolean;
}

export interface DesignFont {
  family: string;
  weights: string[];
  sizes: string[];
  lineHeights: string[];
  letterSpacings: string[];
  count: number;
}

export interface DesignSystem {
  declaredVariables: { name: string; value: string }[];
  colors: DesignColor[];
  gradients: string[];
  fonts: DesignFont[];
  radii: { value: string; count: number }[];
  borders: { value: string; count: number }[];
  shadows: { value: string; count: number }[];
  containers: number[];
  columns: number[];
  spacing: { value: number; count: number }[];
  breakpoints: string[];
}

export interface AssetMapping {
  id: string;
  pageUrl: string;
  sectionId: string | null;
  selector: string;
  kind: AssetKind;
  sourceUrl: string;
  resolvedUrl: string;
  manifestAssetId: string | null;
  match: MatchKind;
  box: Box;
  naturalWidth?: number;
  naturalHeight?: number;
  objectFit: string;
  objectPosition: string;
  opacity: string;
  transform: string;
  borderRadius: string;
  zIndex: string;
  animated: boolean;
  corrected: boolean;
}

export interface MotionRecord {
  id: string;
  kind: string;
  trigger: string;
  duration?: string;
  delay?: string;
  easing?: string;
  properties: string[];
  start?: string;
  end?: string;
  selector: string;
  sectionId: string | null;
  confidence: number;
  limitation?: string;
}

export interface ResponsiveNote {
  viewport: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  sectionCount: number;
  scrollWidth: number;
  scrollHeight: number;
  overflow: boolean;
  notes: string[];
}

export interface AnalysisResult {
  schemaVersion: '2.0.0';
  projectId: string;
  url: string;
  finalUrl: string;
  title: string;
  analyzedAt: string;
  completedAt: string;
  demo: boolean;
  warnings: string[];
  pages: { url: string; title: string }[];
  screenshots: ScreenshotRecord[];
  sections: SectionRecord[];
  designSystem: DesignSystem;
  assetMap: AssetMapping[];
  animations: MotionRecord[];
  interactions: MotionRecord[];
  responsive: ResponsiveNote[];
  manifestAssetIds: string[];
}

export interface ReferenceProject {
  id: string;
  name: string;
  url: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  assetScanStatus: 'none' | 'running' | 'completed' | 'failed';
  analysisStatus: 'none' | 'running' | 'completed' | 'failed';
  scanJobId?: string;
  analysisJobId?: string;
  currentVersionId?: string;
  versions: { id: string; createdAt: string; label: string }[];
  warnings: string[];
  demo: boolean;
}

export interface RawSection {
  selector: string;
  alternateSelector: string;
  tag: string;
  roleAttr: string;
  idAttr: string;
  className: string;
  headings: string[];
  textSample: string;
  box: Box;
  background: string;
  padding: string;
  margin: string;
  display: string;
  position: string;
  zIndex: string;
  layout: string;
  interactiveCount: number;
}

export interface RawAsset {
  selector: string;
  kind: AssetKind;
  url: string;
  box: Box;
  naturalWidth: number;
  naturalHeight: number;
  objectFit: string;
  objectPosition: string;
  opacity: string;
  transform: string;
  borderRadius: string;
  zIndex: string;
  animated: boolean;
  sectionIndex: number;
}

export interface RawStyle {
  color: string;
  background: string;
  fontFamily: string;
  fontWeight: string;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  radius: string;
  border: string;
  shadow: string;
  maxWidth: string;
  gap: string;
  padding: string;
  margin: string;
  columns: number;
}

export interface RawMotion {
  kind: string;
  selector: string;
  trigger: string;
  duration: string;
  delay: string;
  easing: string;
  properties: string[];
  name: string;
  sectionIndex: number;
  limitation: string;
  confidence: number;
}

export interface RawProbe {
  title: string;
  url: string;
  scrollWidth: number;
  scrollHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  sections: RawSection[];
  assets: RawAsset[];
  styles: RawStyle[];
  variables: { name: string; value: string }[];
  breakpoints: string[];
  gradients: string[];
  motions: RawMotion[];
  brokenMedia: number;
  hiddenCount: number;
}

export interface InterpretedPage {
  sections: SectionRecord[];
  designSystem: DesignSystem;
  assetMap: AssetMapping[];
  animations: MotionRecord[];
  interactions: MotionRecord[];
  warnings: string[];
}

export type ManifestRef = Pick<AssetRecord, 'id' | 'url' | 'sourceUrl' | 'resolvedUrl'>;

import type { CatalogItem, MappingRecord, ScopeDecision, StudioDocument } from './model';
import { aspectDelta } from './ratio';

export interface ReadinessIssue {
  code: string;
  severity: 'block' | 'warn';
  manifestAssetId?: string;
  message: string;
}

export interface ReadinessReport {
  total: number;
  inScope: number;
  mapped: number;
  approved: number;
  missing: number;
  customArtwork: number;
  preserved: number;
  omitted: number;
  notApplicable: number;
  percent: number;
  ready: boolean;
  issues: ReadinessIssue[];
}

const RESOLVED: ScopeDecision[] = ['preserve', 'omit', 'not-applicable'];

export function mappingConflicts(studio: StudioDocument, catalog: CatalogItem[]): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const byAsset = new Map(catalog.map((item) => [item.manifestAssetId, item]));
  const seen = new Set<string>();
  for (const mapping of studio.mappings) {
    if (seen.has(mapping.manifestAssetId)) issues.push({ code: 'duplicate-mapping', severity: 'block', manifestAssetId: mapping.manifestAssetId, message: 'More than one mapping exists for the same reference asset.' });
    seen.add(mapping.manifestAssetId);
    if (!mapping.uploadId || (mapping.state !== 'approved' && mapping.state !== 'mapped' && mapping.state !== 'needs-review')) continue;
    const upload = studio.uploads.find((item) => item.id === mapping.uploadId);
    const source = byAsset.get(mapping.manifestAssetId);
    if (!upload) {
      issues.push({ code: 'missing-upload', severity: 'block', manifestAssetId: mapping.manifestAssetId, message: 'The mapped replacement file is missing.' });
      continue;
    }
    if (mapping.derivedId && !studio.derived.some((item) => item.id === mapping.derivedId)) {
      issues.push({ code: 'missing-derived', severity: 'block', manifestAssetId: mapping.manifestAssetId, message: 'The derived variant file is missing.' });
    }
    const delta = source ? aspectDelta(source.width, source.height, upload.width, upload.height) : null;
    if (delta != null && delta > 0.2 && mapping.placement !== 'derived-variant') {
      issues.push({ code: 'aspect', severity: mapping.state === 'approved' ? 'block' : 'warn', manifestAssetId: mapping.manifestAssetId, message: `${source?.filename || 'This asset'} and ${upload.originalFilename} differ in aspect ratio by ${Math.round(delta * 100)}%. Use a fitted variant or approve only after checking the crop.` });
    }
    if (source?.width && upload.width && upload.width < source.width * 0.5 && mapping.state === 'approved') {
      issues.push({ code: 'resolution', severity: 'warn', manifestAssetId: mapping.manifestAssetId, message: `${upload.originalFilename} is much smaller than the displayed reference and may look soft.` });
    }
    if (source?.animated && upload.animated === false && (source.kind === 'video' || source.category === 'videos')) {
      issues.push({ code: 'motion', severity: 'warn', manifestAssetId: mapping.manifestAssetId, message: 'A still image is mapped onto a video placement. The motion will not carry over.' });
    }
  }
  const shared = new Map<string, string[]>();
  for (const mapping of studio.mappings) {
    if (!mapping.uploadId || mapping.state === 'rejected' || mapping.state === 'not-mapped') continue;
    const list = shared.get(mapping.uploadId) || [];
    list.push(mapping.manifestAssetId);
    shared.set(mapping.uploadId, list);
  }
  for (const [uploadId, assets] of shared) {
    if (assets.length < 2) continue;
    const upload = studio.uploads.find((item) => item.id === uploadId);
    issues.push({ code: 'one-to-many', severity: 'warn', message: `${upload?.originalFilename || 'One upload'} is reused on ${assets.length} reference assets.` });
  }
  return issues;
}

export function readinessReport(studio: StudioDocument, catalog: CatalogItem[]): ReadinessReport {
  const issues = mappingConflicts(studio, catalog);
  const roles = new Map(studio.roles.map((role) => [role.manifestAssetId, role]));
  let inScope = 0;
  let mapped = 0;
  let approved = 0;
  let missing = 0;
  let customArtwork = 0;
  let preserved = 0;
  let omitted = 0;
  let notApplicable = 0;
  for (const item of catalog) {
    const role = roles.get(item.manifestAssetId);
    const scope = role?.scope || 'not-applicable';
    const mapping = studio.mappings.find((entry) => entry.manifestAssetId === item.manifestAssetId);
    if (scope === 'preserve') preserved += 1;
    if (scope === 'omit') omitted += 1;
    if (scope === 'not-applicable') notApplicable += 1;
    if (RESOLVED.includes(scope)) continue;
    inScope += 1;
    if (mapping?.placement === 'custom-artwork' && mapping.state === 'approved') {
      customArtwork += 1;
      approved += 1;
      continue;
    }
    if (mapping?.state === 'approved') approved += 1;
    else if (mapping && mapping.state !== 'not-mapped' && mapping.state !== 'rejected') mapped += 1;
    else missing += 1;
  }
  const blocking = issues.filter((issue) => issue.severity === 'block');
  const percent = inScope === 0 ? (catalog.length ? 100 : 0) : Math.round((approved / inScope) * 100);
  return {
    total: catalog.length,
    inScope,
    mapped,
    approved,
    missing,
    customArtwork,
    preserved,
    omitted,
    notApplicable,
    percent,
    ready: inScope > 0 && missing === 0 && approved === inScope && blocking.length === 0,
    issues,
  };
}

export function resolvedMapping(mapping: MappingRecord | undefined): boolean {
  if (!mapping) return false;
  return mapping.state === 'approved';
}

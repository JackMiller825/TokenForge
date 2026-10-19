import type { ReadinessReport } from './readiness';
import type { StudioDocument } from './model';

export interface ReplacementBundle {
  studio: StudioDocument;
  readiness: ReadinessReport;
  filesOnDisk: string[];
}

export function validateReplacementPackage(bundle: ReplacementBundle): string[] {
  const errors: string[] = [];
  const studio = bundle.studio;
  if (studio.schemaVersion !== '3.0.0') errors.push('schemaVersion must be 3.0.0');
  if (!studio.projectId) errors.push('projectId is required');
  const uploadIds = new Set<string>();
  for (const upload of studio.uploads) {
    if (!upload.id || uploadIds.has(upload.id)) errors.push(`Duplicate or missing upload id ${upload.id || ''}`);
    uploadIds.add(upload.id);
    if (!upload.contentHash) errors.push(`Upload ${upload.id} is missing a content hash`);
    if (!bundle.filesOnDisk.includes(upload.relativePath)) errors.push(`Missing upload file ${upload.relativePath}`);
  }
  const derivedIds = new Set<string>();
  for (const derived of studio.derived) {
    if (!derived.id || derivedIds.has(derived.id)) errors.push(`Duplicate or missing derived id ${derived.id || ''}`);
    derivedIds.add(derived.id);
    if (!uploadIds.has(derived.sourceUploadId)) errors.push(`Derived ${derived.id} points at a missing upload`);
    if (!bundle.filesOnDisk.includes(derived.relativePath)) errors.push(`Missing derived file ${derived.relativePath}`);
  }
  const assets = new Set<string>();
  for (const mapping of studio.mappings) {
    if (assets.has(mapping.manifestAssetId)) errors.push(`Duplicate mapping for ${mapping.manifestAssetId}`);
    assets.add(mapping.manifestAssetId);
    if (mapping.uploadId && !uploadIds.has(mapping.uploadId)) errors.push(`Mapping ${mapping.id} points at a missing upload`);
    if (mapping.derivedId && !derivedIds.has(mapping.derivedId)) errors.push(`Mapping ${mapping.id} points at a missing derived file`);
  }
  if (!bundle.readiness || typeof bundle.readiness.percent !== 'number') errors.push('readiness report is missing');
  return errors;
}

import type { AnalysisResult } from './model';

export interface BlueprintFiles {
  manifest: AnalysisResult;
  pages: unknown;
  sections: unknown;
  designSystem: unknown;
  assetMap: unknown;
  animations: unknown;
  interactions: unknown;
  responsive: unknown;
  screenshotFiles: string[];
}

function arrayOf(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function validateBlueprint(bundle: BlueprintFiles): string[] {
  const errors: string[] = [];
  const manifest = bundle.manifest;
  if (!manifest || manifest.schemaVersion !== '2.0.0') errors.push('manifest.schemaVersion must be 2.0.0');
  if (!manifest?.projectId) errors.push('manifest.projectId is required');
  if (!arrayOf(bundle.pages) || !arrayOf(bundle.sections) || !arrayOf(bundle.assetMap) || !arrayOf(bundle.animations) || !arrayOf(bundle.interactions) || !arrayOf(bundle.responsive)) {
    errors.push('pages, sections, assetMap, animations, interactions, and responsive must be arrays');
    return errors;
  }
  if (!bundle.designSystem || typeof bundle.designSystem !== 'object') errors.push('designSystem must be an object');
  const sectionIds = new Set<string>();
  for (const section of bundle.sections as { id?: string }[]) {
    if (!section.id) errors.push('A section is missing an id');
    else if (sectionIds.has(section.id)) errors.push(`Duplicate section id ${section.id}`);
    else sectionIds.add(section.id);
  }
  const assetIds = new Set<string>();
  for (const asset of bundle.assetMap as { id?: string; sectionId?: string | null }[]) {
    if (!asset.id) errors.push('An asset mapping is missing an id');
    else assetIds.add(asset.id);
    if (asset.sectionId && !sectionIds.has(asset.sectionId)) errors.push(`Asset mapping points at missing section ${asset.sectionId}`);
  }
  for (const motion of [...(bundle.animations as { sectionId?: string | null }[]), ...(bundle.interactions as { sectionId?: string | null }[])]) {
    if (motion.sectionId && !sectionIds.has(motion.sectionId)) errors.push(`Motion points at missing section ${motion.sectionId}`);
  }
  for (const shot of manifest.screenshots || []) {
    if (!bundle.screenshotFiles.includes(shot.file)) errors.push(`Screenshot file is missing from the package: ${shot.file}`);
  }
  if (!manifest.screenshots?.some((shot) => shot.kind === 'full-page')) errors.push('A full-page screenshot is required');
  return errors;
}

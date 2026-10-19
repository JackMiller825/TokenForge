import type { IdentityDocument } from './model';

export function validateIdentityPackage(doc: IdentityDocument, files: string[]): string[] {
  const errors: string[] = [];
  if (doc.schemaVersion !== '4.0.0') errors.push('schemaVersion must be 4.0.0');
  if (!doc.projectId) errors.push('projectId is required');
  const required = [
    'identity/token.json',
    'identity/tokenomics.json',
    'identity/narrative.json',
    'identity/sections.json',
    'identity/links.json',
    'identity/seo.json',
    'identity/appearance.json',
    'reports/brand-consistency.json',
    'reports/validation.json',
    'mapping/phase5-input.json',
    'manifest.json',
    'README.md',
  ];
  for (const name of required) if (!files.includes(name)) errors.push(`Missing ${name}`);
  const ids = new Set<string>();
  for (const section of doc.sections) {
    if (!section.id || ids.has(section.id)) errors.push(`Duplicate or missing section id ${section.id || ''}`);
    ids.add(section.id);
  }
  return errors;
}

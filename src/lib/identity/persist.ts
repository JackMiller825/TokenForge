import type { IdentityDocument, IdentityRevision } from './model';

export function identityFingerprint(doc: IdentityDocument): string {
  const { updatedAt: _updatedAt, revisions: _revisions, ...rest } = doc;
  return JSON.stringify(rest);
}

export function applyConfirmedSave(local: IdentityDocument, confirmed: IdentityDocument): IdentityDocument {
  return { ...local, updatedAt: confirmed.updatedAt, revisions: confirmed.revisions };
}

export function shouldExport(saved: { updatedAt?: string; revisions?: IdentityRevision[] } | null): boolean {
  return Boolean(saved?.updatedAt);
}

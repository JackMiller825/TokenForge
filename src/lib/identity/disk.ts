import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ProjectStore } from '../projects/store';
import { catalogFrom } from '../replace/catalog';
import { readStudio } from '../replace/disk';
import { brandReport } from './consistency';
import { blockingIssue, createIdentity, normalizeIdentity, reconcileIdentity } from './document';
import type { IdentityDocument } from './model';
import { phase5Readiness } from './readiness';

export function readIdentity(dir: string): IdentityDocument | null {
  try {
    return JSON.parse(readFileSync(join(dir, 'identity.json'), 'utf8')) as IdentityDocument;
  } catch {
    return null;
  }
}

export function writeIdentity(dir: string, doc: IdentityDocument) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'identity.json');
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(doc, null, 2));
  renameSync(temporary, file);
}

export function writeRevision(dir: string, doc: IdentityDocument, label: string): IdentityDocument {
  const id = randomUUID();
  const at = new Date().toISOString();
  mkdirSync(join(dir, 'identity', 'revisions'), { recursive: true });
  writeFileSync(join(dir, 'identity', 'revisions', `${id}.json`), JSON.stringify(doc, null, 2));
  const next = { ...doc, updatedAt: at, revisions: [...doc.revisions, { id, at, label: label.slice(0, 80) || at }].slice(-20) };
  writeIdentity(dir, next);
  return next;
}

export function readRevision(dir: string, id: string): IdentityDocument | null {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    return JSON.parse(readFileSync(join(dir, 'identity', 'revisions', `${id}.json`), 'utf8')) as IdentityDocument;
  } catch {
    return null;
  }
}

export function openIdentity(store: ProjectStore, projectId: string) {
  const project = store.get(projectId);
  if (!project) return null;
  const dir = store.dir(projectId);
  const analysis = store.readAnalysis(projectId);
  const scan = store.readScan(projectId);
  const studio = readStudio(dir);
  const existing = readIdentity(dir);
  let identity = normalizeIdentity(existing ? reconcileIdentity(existing, analysis) : createIdentity(projectId, project.title || project.name, project.url, analysis));
  if (!existing && analysis?.designSystem) {
    const accent = analysis.designSystem.colors[0]?.value;
    const background = analysis.designSystem.colors[1]?.value;
    const fontFamily = analysis.designSystem.fonts[0]?.family;
    identity = {
      ...identity,
      appearance: {
        ...identity.appearance,
        accent: accent || identity.appearance.accent,
        background: background || identity.appearance.background,
        fontFamily: fontFamily || identity.appearance.fontFamily,
      },
    };
  }
  if (!existing || identity.sections.length !== existing.sections.length) writeIdentity(dir, identity);
  const catalog = catalogFrom(scan, analysis);
  const textAssets = [
    ...(studio?.uploads || []).filter((upload) => upload.containsText === 'yes').map((upload) => ({ id: upload.id, filename: upload.originalFilename })),
    ...(studio?.roles || []).filter((role) => role.containsText === 'yes').map((role) => ({ id: role.manifestAssetId, filename: catalog.find((item) => item.manifestAssetId === role.manifestAssetId)?.filename || role.manifestAssetId })),
  ];
  const approvedAssets = (studio?.mappings || []).filter((mapping) => mapping.state === 'approved').map((mapping) => {
    const upload = studio?.uploads.find((item) => item.id === mapping.uploadId);
    return { id: mapping.manifestAssetId, uploadId: mapping.uploadId, filename: upload?.originalFilename || mapping.manifestAssetId, width: upload?.width, height: upload?.height };
  });
  const readiness = phase5Readiness(identity, analysis, studio, scan, textAssets, approvedAssets);
  return {
    project,
    dir,
    identity,
    analysis,
    scan,
    studio,
    report: brandReport(identity, textAssets),
    readiness,
    approvedAssets,
    design: analysis?.designSystem ? { colors: analysis.designSystem.colors.slice(0, 6), fonts: analysis.designSystem.fonts.slice(0, 4) } : null,
  };
}

export function saveIdentity(store: ProjectStore, projectId: string, doc: IdentityDocument) {
  const normalized = normalizeIdentity({ ...doc, projectId, updatedAt: new Date().toISOString() });
  const blocked = blockingIssue(normalized);
  if (blocked) throw new Error(blocked);
  writeIdentity(store.dir(projectId), normalized);
  const opened = openIdentity(store, projectId);
  if (!opened) return null;
  const project = store.update(projectId, { identityStatus: opened.readiness.ready ? 'ready' : 'draft' });
  return { ...opened, project };
}

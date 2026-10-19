import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisResult } from '../analyze/model';
import type { ProjectStore } from '../projects/store';
import type { ScanResult } from '../types';
import { catalogFrom } from './catalog';
import { readinessReport } from './readiness';
import type { StudioDocument } from './model';
import { freshStudio, mascotChecklist, reconcile } from './studio';

export function readStudio(dir: string): StudioDocument | null {
  try {
    return JSON.parse(readFileSync(join(dir, 'studio.json'), 'utf8')) as StudioDocument;
  } catch {
    return null;
  }
}

export function writeStudio(dir: string, studio: StudioDocument) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'studio.json');
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(studio, null, 2));
  renameSync(temporary, file);
}

export function writeStudioFile(dir: string, relative: string, bytes: Buffer) {
  const full = join(dir, relative);
  mkdirSync(join(full, '..'), { recursive: true });
  const temporary = `${full}.${process.pid}.tmp`;
  writeFileSync(temporary, bytes);
  renameSync(temporary, full);
}

export function openProjectStudio(store: ProjectStore, id: string) {
  const project = store.get(id);
  if (!project) return null;
  const dir = store.dir(id);
  const scan = store.readScan(id);
  const analysis = store.readAnalysis(id);
  const existing = readStudio(dir);
  const studio = existing ? reconcile(existing, scan, analysis) : freshStudio(id, scan, analysis, project.demo);
  if (!existing || studio.roles.length !== existing.roles.length) writeStudio(dir, studio);
  const catalog = catalogFrom(scan, analysis);
  const readiness = readinessReport(studio, catalog);
  return { project, dir, scan, analysis, studio, catalog, readiness };
}

export function saveProjectStudio(store: ProjectStore, id: string, studio: StudioDocument, scan: ScanResult | null, analysis: AnalysisResult | null) {
  writeStudio(store.dir(id), studio);
  const readiness = readinessReport(studio, catalogFrom(scan, analysis));
  store.update(id, { replacementStatus: readiness.ready ? 'ready' : 'draft' });
  return readiness;
}

export function presentStudio(store: ProjectStore, id: string) {
  const opened = openProjectStudio(store, id);
  if (!opened) return null;
  return {
    project: opened.project,
    studio: opened.studio,
    catalog: opened.catalog,
    readiness: opened.readiness,
    conflicts: opened.readiness.issues,
    sections: (opened.analysis?.sections || []).map((section) => ({ id: section.id, name: section.name, role: section.role })),
    screenshots: opened.analysis?.screenshots || [],
    checklist: mascotChecklist(opened.studio, opened.catalog),
  };
}

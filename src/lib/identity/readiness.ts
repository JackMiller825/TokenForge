import type { AnalysisResult } from '../analyze/model';
import type { StudioDocument } from '../replace/model';
import { readinessReport } from '../replace/readiness';
import { catalogFrom } from '../replace/catalog';
import type { ScanResult } from '../types';
import { brandReport } from './consistency';
import type { IdentityDocument } from './model';
import { mediaIssues, validateIdentity, type FieldIssue } from './validate';

export interface Phase5Readiness {
  ready: boolean;
  blockers: FieldIssue[];
  warnings: FieldIssue[];
}

export function phase5Readiness(doc: IdentityDocument, analysis: AnalysisResult | null, studio: StudioDocument | null, scan: ScanResult | null, textAssets: { id: string; filename: string }[] = [], media: { id: string; width?: number; height?: number }[] = []): Phase5Readiness {
  const blockers: FieldIssue[] = [];
  const warnings: FieldIssue[] = [];
  if (!analysis) blockers.push({ code: 'blueprint', severity: 'block', field: 'analysis', message: 'A website blueprint is required before generation.' });
  if (!doc.token.name.trim()) blockers.push({ code: 'name', severity: 'block', field: 'token.name', message: 'A token name is required.' });
  if (!doc.token.ticker.trim()) blockers.push({ code: 'ticker', severity: 'block', field: 'token.ticker', message: 'A ticker is required.' });
  const visible = doc.sections.filter((section) => !section.hidden);
  if (analysis && !visible.length) blockers.push({ code: 'sections', severity: 'block', field: 'sections', message: 'At least one blueprint section must stay visible.' });
  if (visible.some((section) => !section.headline.trim() && !section.displayName.trim())) {
    blockers.push({ code: 'copy', severity: 'block', field: 'sections', message: 'Every visible section needs a display name or headline.' });
  }
  for (const issue of validateIdentity(doc)) (issue.severity === 'block' ? blockers : warnings).push(issue);
  if (studio) {
    const report = readinessReport(studio, catalogFrom(scan, analysis));
    const blocks = report.issues.filter((issue) => issue.severity === 'block');
    for (const issue of blocks) blockers.push({ code: issue.code, severity: 'block', field: 'replacements', message: issue.message });
    if (!report.ready && !blocks.length) warnings.push({ code: 'replacements', severity: 'warn', field: 'replacements', message: 'Phase 3 replacements are not fully approved. Generation can wait, or you can continue with this warning.' });
  } else warnings.push({ code: 'replacements', severity: 'warn', field: 'replacements', message: 'No replacement studio is saved yet.' });
  for (const issue of mediaIssues(doc, media)) warnings.push(issue);
  for (const check of brandReport(doc, textAssets)) {
    if (check.severity === 'warn') warnings.push({ code: check.code, severity: 'warn', field: 'brand', message: check.message });
  }
  return { ready: blockers.length === 0, blockers, warnings };
}

export interface WebsiteGenerationInput {
  schemaVersion: '4.0.0';
  projectId: string;
  blueprint: { present: boolean; sectionIds: string[] };
  designTokensPresent: boolean;
  approvedAssetIds: string[];
  identity: IdentityDocument;
  responsiveNotes: number;
  animationCount: number;
}

export function generationInput(doc: IdentityDocument, analysis: AnalysisResult | null, studio: StudioDocument | null): WebsiteGenerationInput {
  return {
    schemaVersion: '4.0.0',
    projectId: doc.projectId,
    blueprint: { present: Boolean(analysis), sectionIds: doc.sections.map((section) => section.id) },
    designTokensPresent: Boolean(analysis?.designSystem),
    approvedAssetIds: (studio?.mappings || []).filter((mapping) => mapping.state === 'approved').map((mapping) => mapping.manifestAssetId),
    identity: doc,
    responsiveNotes: analysis?.responsive.length || 0,
    animationCount: (analysis?.animations.length || 0) + (analysis?.interactions.length || 0),
  };
}

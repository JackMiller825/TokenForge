import { randomUUID } from 'node:crypto';
import type { AnalysisResult, SectionRecord } from '../analyze/model';
import { LIMITS } from '../config';
import { sanitizeRichText, plain } from './sanitize';
import { applyEmptySuggestions } from './suggest';
import type { ContractStatus, IdentityDocument, LaunchStatus, LinkLocation, SectionCopy, Tone } from './model';
import { emptyIdentity, LINK_TYPES } from './model';
import { evidenceValue, toneValue, validateIdentity } from './validate';

export function createIdentity(projectId: string, referenceTitle: string, referenceUrl: string, analysis: AnalysisResult | null): IdentityDocument {
  const doc = emptyIdentity(projectId, referenceTitle, referenceUrl);
  doc.sections = (analysis?.sections || []).map((section, index) => sectionFromBlueprint(section, index));
  return doc;
}

export function reconcileIdentity(doc: IdentityDocument, analysis: AnalysisResult | null): IdentityDocument {
  const known = new Set(doc.sections.map((section) => section.sourceSectionId).filter(Boolean));
  const added = (analysis?.sections || []).filter((section) => !known.has(section.id)).map((section, index) => sectionFromBlueprint(section, doc.sections.length + index));
  if (!added.length) return doc;
  return { ...doc, sections: [...doc.sections, ...added] };
}

export function assertIdentityShape(value: unknown): IdentityDocument {
  if (!value || typeof value !== 'object') throw new Error('Identity import must be a JSON object.');
  const doc = value as IdentityDocument;
  if (doc.schemaVersion !== '4.0.0') throw new Error('Identity schema must be 4.0.0.');
  if (!doc.token || !doc.tokenomics || !doc.narrative || !Array.isArray(doc.sections) || !Array.isArray(doc.links) || !doc.seo) {
    throw new Error('Identity import is missing a required section.');
  }
  return doc;
}

export function normalizeIdentity(input: IdentityDocument): IdentityDocument {
  const source = assertIdentityShape(input);
  const doc = structuredClone(source);
  const fallback = emptyIdentity(doc.projectId || 'project');
  doc.token = { ...fallback.token, ...doc.token };
  doc.tokenomics = { ...fallback.tokenomics, ...doc.tokenomics };
  doc.narrative = { ...fallback.narrative, ...doc.narrative };
  doc.seo = { ...fallback.seo, ...doc.seo };
  doc.appearance = { ...fallback.appearance, ...doc.appearance };
  doc.token.name = text(doc.token.name, 80);
  doc.token.ticker = text(doc.token.ticker, 12);
  doc.token.tagline = text(doc.token.tagline, 160);
  doc.token.shortDescription = text(doc.token.shortDescription, 400);
  doc.token.longDescription = rich(doc.token.longDescription);
  doc.token.websiteTitle = text(doc.token.websiteTitle, 80);
  doc.token.seoDescription = text(doc.token.seoDescription, 220);
  doc.token.contractAddress = text(doc.token.contractAddress, 120).trim();
  doc.token.customNetwork = text(doc.token.customNetwork, 40);
  doc.token.networkId = text(doc.token.networkId, 40) || 'solana';
  doc.token.faviconAssetId = text(doc.token.faviconAssetId, 80);
  doc.token.contractStatus = contractStatus(doc.token.contractStatus);
  doc.token.launchStatus = launchStatus(doc.token.launchStatus);
  doc.narrative.tone = toneValue(doc.narrative.tone);
  doc.narrative.origin = rich(doc.narrative.origin);
  doc.narrative.mascot = rich(doc.narrative.mascot);
  doc.narrative.personality = rich(doc.narrative.personality);
  doc.narrative.project = rich(doc.narrative.project);
  doc.narrative.moments = rich(doc.narrative.moments);
  doc.narrative.community = rich(doc.narrative.community);
  doc.narrative.voice = text(doc.narrative.voice, 500);
  doc.narrative.slogans = text(doc.narrative.slogans, 500);
  doc.narrative.callsToAction = text(doc.narrative.callsToAction, 300);
  doc.narrative.faqs = rich(doc.narrative.faqs);
  doc.narrative.roadmap = rich(doc.narrative.roadmap);
  doc.tokenomics.totalSupply = text(doc.tokenomics.totalSupply, 40);
  doc.tokenomics.buyTax = text(doc.tokenomics.buyTax, 20);
  doc.tokenomics.sellTax = text(doc.tokenomics.sellTax, 20);
  doc.tokenomics.liquidityLabel = text(doc.tokenomics.liquidityLabel, 40);
  doc.tokenomics.ownershipLabel = text(doc.tokenomics.ownershipLabel, 40);
  doc.tokenomics.liquidityEvidence = evidenceValue(doc.tokenomics.liquidityEvidence);
  doc.tokenomics.ownershipEvidence = evidenceValue(doc.tokenomics.ownershipEvidence);
  doc.sections = doc.sections.filter((section) => section && typeof section.id === 'string' && section.id.length > 0 && section.id.length < 80).slice(0, 80).map((section, order) => ({
    id: section.id,
    sourceSectionId: section.sourceSectionId || null,
    order,
    hidden: Boolean(section.hidden),
    displayName: text(section.displayName, 120),
    purpose: text(section.purpose, 40),
    headline: text(section.headline, 160),
    subheadline: text(section.subheadline, 240),
    description: text(section.description, 600),
    body: rich(section.body),
    mobileCopy: text(section.mobileCopy, 600),
    primaryButton: text(section.primaryButton, 40),
    secondaryButton: text(section.secondaryButton, 40),
    buttonDestination: text(section.buttonDestination, 500),
    assetIds: Array.isArray(section.assetIds) ? section.assetIds.map((id) => text(id, 80)).filter(Boolean).slice(0, 20) : [],
    backgroundAssetId: text(section.backgroundAssetId, 80),
    notes: text(section.notes, 500),
    duplicated: Boolean(section.duplicated),
  }));
  doc.links = doc.links.filter((link) => link && typeof link === 'object').slice(0, 40).map((link) => {
    const type = LINK_TYPES.some((item) => item.id === link.type) ? link.type : 'custom';
    const locations = (Array.isArray(link.locations) ? link.locations : []).filter((location): location is LinkLocation => ['header', 'hero', 'body', 'footer'].includes(location));
    return {
      id: text(link.id, 80) || randomUUID(),
      type,
      label: text(link.label, 40),
      url: text(link.url, 500).trim(),
      enabled: Boolean(link.enabled),
      status: link.status === 'configured' ? 'configured' as const : 'coming-soon' as const,
      locations,
      icon: text(link.icon, 40),
    };
  });
  doc.seo.ogTitle = text(doc.seo.ogTitle, 80);
  doc.seo.ogDescription = text(doc.seo.ogDescription, 220);
  doc.seo.shareImageAssetId = text(doc.seo.shareImageAssetId, 80);
  doc.seo.canonicalUrl = text(doc.seo.canonicalUrl, 500).trim();
  doc.seo.robots = doc.seo.robots === 'noindex,nofollow' ? 'noindex,nofollow' : 'index,follow';
  doc.seo.structuredData = doc.seo.structuredData === 'website' ? 'website' : 'none';
  doc.appearance.accent = text(doc.appearance.accent, 40);
  doc.appearance.background = text(doc.appearance.background, 40);
  doc.appearance.text = text(doc.appearance.text, 40);
  doc.appearance.fontFamily = text(doc.appearance.fontFamily, 80);
  doc.exceptions = (Array.isArray(doc.exceptions) ? doc.exceptions : []).map((item) => text(item, 80)).filter(Boolean).slice(0, 40);
  doc.approvedFields = (Array.isArray(doc.approvedFields) ? doc.approvedFields : []).map((item) => text(item, 120)).filter(Boolean).slice(0, 200);
  doc.revisions = Array.isArray(doc.revisions) ? doc.revisions.filter((item) => item && typeof item.id === 'string').slice(-20) : [];
  doc.referenceTitle = text(doc.referenceTitle, 160);
  doc.referenceUrl = text(doc.referenceUrl, 500);
  const encoded = JSON.stringify(doc);
  if (encoded.length > LIMITS.maxIdentityBytes) throw new Error('The identity profile is larger than the save limit.');
  return doc;
}

export function blockingIssue(doc: IdentityDocument): string | null {
  return validateIdentity(doc).find((issue) => issue.severity === 'block')?.message || null;
}

export function duplicateSection(doc: IdentityDocument, sectionId: string): IdentityDocument {
  const source = doc.sections.find((section) => section.id === sectionId);
  if (!source) throw new Error('That section is not in this identity.');
  if (!source.sourceSectionId) throw new Error('Only blueprint sections can be duplicated.');
  const copy: SectionCopy = { ...source, id: `copy-${randomUUID()}`, order: doc.sections.length, duplicated: true, displayName: `${source.displayName} copy` };
  return { ...doc, sections: [...doc.sections, copy] };
}

export function reorderSections(doc: IdentityDocument, ids: string[]): IdentityDocument {
  const byId = new Map(doc.sections.map((section) => [section.id, section]));
  if (ids.length !== doc.sections.length || ids.some((id) => !byId.has(id))) throw new Error('The section order does not match this project.');
  return { ...doc, sections: ids.map((id, order) => ({ ...byId.get(id)!, order })) };
}

export function setTone(doc: IdentityDocument, tone: Tone): IdentityDocument {
  return { ...doc, narrative: { ...doc.narrative, tone } };
}

export function fillSuggestions(doc: IdentityDocument): IdentityDocument {
  return applyEmptySuggestions(doc).document;
}

export function restoreSection(doc: IdentityDocument, sectionId: string, analysis: AnalysisResult | null): IdentityDocument {
  const section = doc.sections.find((item) => item.id === sectionId);
  if (!section?.sourceSectionId) throw new Error('This block has no blueprint source to restore.');
  const source = analysis?.sections.find((item) => item.id === section.sourceSectionId);
  if (!source) throw new Error('The blueprint section is no longer in this project.');
  return {
    ...doc,
    sections: doc.sections.map((item) => item.id === sectionId ? {
      ...item,
      displayName: source.name,
      purpose: String(source.role),
      headline: '',
      subheadline: '',
      description: '',
      body: '',
      mobileCopy: '',
      primaryButton: '',
      secondaryButton: '',
      buttonDestination: '',
      notes: '',
    } : item),
  };
}

export function compareIdentity(left: IdentityDocument, right: IdentityDocument): { field: string; before: string; after: string }[] {
  const fields = ['token.name', 'token.ticker', 'token.tagline', 'token.contractAddress', 'token.contractStatus', 'narrative.origin', 'narrative.tone'];
  return fields.flatMap((field) => {
    const before = readPath(left, field);
    const after = readPath(right, field);
    return before === after ? [] : [{ field, before, after }];
  });
}

function readPath(doc: IdentityDocument, field: string): string {
  const [group, key] = field.split('.');
  const bag = (doc as unknown as Record<string, Record<string, string>>)[group];
  return bag ? String(bag[key] ?? '') : '';
}

function text(value: unknown, max: number): string {
  return plain(typeof value === 'string' ? value : '', max);
}

function rich(value: unknown): string {
  return sanitizeRichText(typeof value === 'string' ? value : '');
}

function contractStatus(value: string): ContractStatus {
  if (value === 'configured' || value === 'unverified' || value === 'coming-soon') return value;
  return 'coming-soon';
}

function launchStatus(value: string): LaunchStatus {
  if (value === 'planned' || value === 'live' || value === 'coming-soon') return value;
  return 'coming-soon';
}

function sectionFromBlueprint(section: SectionRecord, order: number): SectionCopy {
  return {
    id: section.id,
    sourceSectionId: section.id,
    order,
    hidden: false,
    displayName: section.name,
    purpose: String(section.role),
    headline: '',
    subheadline: '',
    description: '',
    body: '',
    mobileCopy: '',
    primaryButton: '',
    secondaryButton: '',
    buttonDestination: '',
    assetIds: [],
    backgroundAssetId: '',
    notes: '',
    duplicated: false,
  };
}

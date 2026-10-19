import { randomUUID } from 'node:crypto';
import type { AnalysisResult } from '../analyze/model';
import type { ScanResult } from '../types';
import { catalogFrom } from './catalog';
import type { AssetRole, BrandPreset, CatalogItem, DerivedAsset, MappingRecord, MappingState, PlacementAction, ReferenceRole, SafeZone, ScopeDecision, StudioDocument, StudioSlice, TextMark, UploadedAsset } from './model';
import { ASSET_ROLES, emptyStudio } from './model';
import { defaultScope, inferReferenceRole } from './roles';
import { applySuggestion, suggestFor } from './suggest';
import type { InspectedFile } from './inspect';

const UNDO_LIMIT = 30;

export function freshStudio(projectId: string, scan: ScanResult | null, analysis: AnalysisResult | null, demo = false): StudioDocument {
  const studio = emptyStudio(projectId, demo);
  const now = studio.updatedAt;
  for (const item of catalogFrom(scan, analysis)) {
    const guess = inferReferenceRole(item);
    studio.roles.push(roleFor(item.manifestAssetId, guess.role, true, guess.confidence, guess.reason, defaultScope(item.category)));
    studio.mappings.push(blankMapping(item.manifestAssetId, now));
  }
  studio.history.push({ at: now, action: 'create', detail: 'Opened the replacement studio.' });
  return studio;
}

export function reconcile(studio: StudioDocument, scan: ScanResult | null, analysis: AnalysisResult | null): StudioDocument {
  const now = new Date().toISOString();
  const next = { ...studio, roles: [...studio.roles], mappings: [...studio.mappings] };
  for (const item of catalogFrom(scan, analysis)) {
    if (!next.roles.some((role) => role.manifestAssetId === item.manifestAssetId)) {
      const guess = inferReferenceRole(item);
      next.roles.push(roleFor(item.manifestAssetId, guess.role, true, guess.confidence, guess.reason, defaultScope(item.category)));
    }
    if (!next.mappings.some((mapping) => mapping.manifestAssetId === item.manifestAssetId)) next.mappings.push(blankMapping(item.manifestAssetId, now));
  }
  return next;
}

export function rememberUpload(studio: StudioDocument, file: InspectedFile, id = randomUUID()): { studio: StudioDocument; upload: UploadedAsset; reused: boolean } {
  const existing = studio.uploads.find((upload) => upload.contentHash === file.contentHash);
  if (existing) return { studio, upload: existing, reused: true };
  const upload: UploadedAsset = {
    id,
    originalFilename: file.originalFilename,
    relativePath: `studio/uploads/${id}.${file.extension}`,
    mimeType: file.mimeType,
    extension: file.extension,
    bytes: file.bytes,
    width: file.width,
    height: file.height,
    aspect: file.aspect,
    hasAlpha: file.hasAlpha,
    animated: file.animated,
    durationSeconds: file.durationSeconds,
    contentHash: file.contentHash,
    containsText: file.containsText,
    createdAt: new Date().toISOString(),
    role: file.role,
    roleInferred: true,
  };
  const next = snapshot(studio);
  next.uploads = [...studio.uploads, upload];
  next.history = [...studio.history, { at: upload.createdAt, action: 'upload', detail: `Stored ${upload.originalFilename}.` }].slice(-80);
  return { studio: next, upload, reused: false };
}

export function rememberDerived(studio: StudioDocument, derived: DerivedAsset, manifestAssetId?: string): StudioDocument {
  const next = snapshot(studio);
  next.derived = [...studio.derived.filter((item) => item.id !== derived.id), derived];
  if (manifestAssetId) {
    next.mappings = studio.mappings.map((mapping) => mapping.manifestAssetId === manifestAssetId ? {
      ...mapping,
      derivedId: derived.id,
      uploadId: mapping.uploadId || derived.sourceUploadId,
      placement: 'derived-variant' as PlacementAction,
      state: mapping.state === 'approved' ? 'needs-review' as MappingState : mapping.state === 'not-mapped' ? 'mapped' as MappingState : mapping.state,
      explanation: `${mapping.explanation} Derived ${derived.width}×${derived.height}. ${derived.warnings.join(' ')}`.trim(),
      revision: mapping.revision + 1,
      updatedAt: derived.createdAt,
    } : mapping);
  }
  next.history = [...studio.history, { at: derived.createdAt, action: 'derive', detail: derived.operation }].slice(-80);
  return next;
}

export interface StudioAction {
  action: string;
  manifestAssetId?: string;
  uploadId?: string | null;
  derivedId?: string | null;
  role?: AssetRole;
  scope?: ScopeDecision;
  state?: MappingState;
  placement?: PlacementAction;
  mappingIds?: string[];
  confirm?: boolean;
  containsText?: TextMark;
  safeZone?: SafeZone | null;
  preset?: BrandPreset;
  objectFit?: 'contain' | 'cover' | 'fill';
  objectPosition?: string;
  focalX?: number;
  focalY?: number;
  note?: string;
}

export function applyStudioAction(studio: StudioDocument, catalog: CatalogItem[], action: StudioAction): StudioDocument {
  if (action.action === 'undo') return undo(studio);
  if (action.action === 'redo') return redo(studio);
  if (action.action === 'suggest') return suggestAll(studio, catalog);
  const next = snapshot(studio);
  const now = new Date().toISOString();
  if (action.action === 'set-role' && action.manifestAssetId && action.role && ASSET_ROLES.includes(action.role)) {
    next.roles = next.roles.map((role) => role.manifestAssetId === action.manifestAssetId ? { ...role, role: action.role!, roleInferred: false, confidence: 1, reason: 'Corrected in the studio.' } : role);
    note(next, now, 'set-role', `Role for ${action.manifestAssetId} set to ${action.role}.`);
  } else if (action.action === 'set-scope' && action.manifestAssetId && action.scope) {
    next.roles = next.roles.map((role) => role.manifestAssetId === action.manifestAssetId ? { ...role, scope: action.scope! } : role);
    note(next, now, 'set-scope', `${action.manifestAssetId} marked ${action.scope}.`);
  } else if (action.action === 'set-text' && action.manifestAssetId && action.containsText) {
    next.roles = next.roles.map((role) => role.manifestAssetId === action.manifestAssetId ? { ...role, containsText: action.containsText! } : role);
    note(next, now, 'set-text', `Text mark set to ${action.containsText}.`);
  } else if (action.action === 'upload-role' && action.uploadId && action.role && ASSET_ROLES.includes(action.role)) {
    next.uploads = next.uploads.map((upload) => upload.id === action.uploadId ? { ...upload, role: action.role!, roleInferred: false } : upload);
    if (action.role === 'main-mascot') next.mascotUploadId = action.uploadId;
    note(next, now, 'upload-role', `Upload role set to ${action.role}.`);
  } else if (action.action === 'upload-text' && action.uploadId && action.containsText) {
    next.uploads = next.uploads.map((upload) => upload.id === action.uploadId ? { ...upload, containsText: action.containsText!, safeZone: action.safeZone || upload.safeZone } : upload);
    note(next, now, 'upload-text', 'Updated the text mark on an upload.');
  } else if (action.action === 'mascot' && action.uploadId) {
    if (!next.uploads.some((upload) => upload.id === action.uploadId)) throw new Error('That upload is not in this project.');
    next.mascotUploadId = action.uploadId;
    note(next, now, 'mascot', 'Chose the mascot artwork.');
  } else if (action.action === 'map' && action.manifestAssetId) {
    next.mappings = next.mappings.map((mapping) => mapping.manifestAssetId === action.manifestAssetId ? manualMap(mapping, next, catalog, action, now) : mapping);
    note(next, now, 'map', `Mapped ${action.manifestAssetId}.`);
  } else if (action.action === 'restore' && action.manifestAssetId) {
    next.mappings = next.mappings.map((mapping) => mapping.manifestAssetId === action.manifestAssetId ? { ...blankMapping(mapping.manifestAssetId, now), revision: mapping.revision + 1 } : mapping);
    note(next, now, 'restore', `Restored ${action.manifestAssetId} to unmapped.`);
  } else if (action.action === 'state' && action.manifestAssetId && action.state) {
    next.mappings = next.mappings.map((mapping) => mapping.manifestAssetId === action.manifestAssetId ? transition(mapping, action.state!, now) : mapping);
    note(next, now, 'state', `${action.manifestAssetId} is ${action.state}.`);
  } else if (action.action === 'placement' && action.manifestAssetId && action.placement) {
    next.mappings = next.mappings.map((mapping) => mapping.manifestAssetId === action.manifestAssetId ? { ...mapping, placement: action.placement!, revision: mapping.revision + 1, updatedAt: now, state: mapping.state === 'approved' ? 'needs-review' : mapping.state } : mapping);
    note(next, now, 'placement', `Placement set to ${action.placement}.`);
  } else if (action.action === 'override' && action.manifestAssetId) {
    next.mappings = next.mappings.map((mapping) => mapping.manifestAssetId === action.manifestAssetId ? {
      ...mapping,
      overrides: { ...mapping.overrides, objectFit: action.objectFit || mapping.overrides.objectFit, objectPosition: action.objectPosition || mapping.overrides.objectPosition, focalX: action.focalX ?? mapping.overrides.focalX, focalY: action.focalY ?? mapping.overrides.focalY },
      revision: mapping.revision + 1,
      updatedAt: now,
    } : mapping);
    note(next, now, 'override', 'Saved placement overrides.');
  } else if (action.action === 'bulk-approve') {
    if (!action.confirm) throw new Error('Bulk approval needs confirmation.');
    const ids = new Set(action.mappingIds || []);
    next.mappings = next.mappings.map((mapping) => ids.has(mapping.id) && (mapping.state === 'mapped' || mapping.state === 'needs-review') ? { ...mapping, state: 'approved', revision: mapping.revision + 1, updatedAt: now } : mapping);
    note(next, now, 'bulk-approve', `Approved ${action.mappingIds?.length || 0} mappings.`);
  } else if (action.action === 'preset' && action.preset?.id && action.preset.name && action.preset.width > 0 && action.preset.height > 0) {
    const preset = { ...action.preset, width: Math.round(action.preset.width), height: Math.round(action.preset.height) };
    next.presets = next.presets.some((item) => item.id === preset.id) ? next.presets.map((item) => item.id === preset.id ? preset : item) : [...next.presets, preset];
    note(next, now, 'preset', `Saved preset ${preset.name}.`);
  } else if (action.action === 'note') {
    note(next, now, 'note', (action.note || '').slice(0, 400));
  } else {
    throw new Error('Unknown studio action.');
  }
  next.updatedAt = now;
  return next;
}

function suggestAll(studio: StudioDocument, catalog: CatalogItem[]): StudioDocument {
  const next = snapshot(studio);
  const now = new Date().toISOString();
  let count = 0;
  next.mappings = studio.mappings.map((mapping) => {
    if (mapping.state === 'mapped' || mapping.state === 'needs-review' || mapping.state === 'approved' || mapping.state === 'rejected') return mapping;
    const item = catalog.find((entry) => entry.manifestAssetId === mapping.manifestAssetId);
    const role = studio.roles.find((entry) => entry.manifestAssetId === mapping.manifestAssetId);
    if (!item || !role) return mapping;
    const uploads = studio.mascotUploadId && (role.role === 'main-mascot' || role.role === 'logo')
      ? [...studio.uploads.filter((upload) => upload.id === studio.mascotUploadId), ...studio.uploads.filter((upload) => upload.id !== studio.mascotUploadId)]
      : studio.uploads;
    const suggestion = suggestFor(item, role.role, uploads);
    if (!suggestion) return mapping;
    count += 1;
    return applySuggestion(mapping, suggestion, now);
  });
  note(next, now, 'suggest', `Suggested ${count} mappings. None were approved automatically.`);
  next.updatedAt = now;
  return next;
}

function manualMap(mapping: MappingRecord, studio: StudioDocument, catalog: CatalogItem[], action: StudioAction, now: string): MappingRecord {
  const upload = action.uploadId ? studio.uploads.find((item) => item.id === action.uploadId) : undefined;
  if (action.uploadId && !upload) throw new Error('That replacement is not in this project.');
  const item = catalog.find((entry) => entry.manifestAssetId === mapping.manifestAssetId);
  const suggestion = upload && item ? suggestFor(item, studio.roles.find((role) => role.manifestAssetId === item.manifestAssetId)?.role || upload.role, [upload]) : null;
  const confidence = suggestion?.confidence ?? (upload ? 0.5 : 0);
  return {
    ...mapping,
    uploadId: upload?.id || null,
    derivedId: action.derivedId === undefined ? mapping.derivedId : action.derivedId,
    state: upload ? (confidence >= 0.6 ? 'mapped' : 'needs-review') : 'not-mapped',
    confidence,
    explanation: suggestion?.explanation || (upload ? `Manual mapping to ${upload.originalFilename}.` : 'Mapping cleared.'),
    placement: mapping.placement === 'preserve-original' ? 'use-upload' : mapping.placement,
    revision: mapping.revision + 1,
    updatedAt: now,
  };
}

function transition(mapping: MappingRecord, state: MappingState, now: string): MappingRecord {
  if (state === 'approved' && mapping.state === 'not-mapped') throw new Error('Map a replacement before approving it.');
  if (state === 'approved' && mapping.state === 'suggested' && mapping.confidence < 0.6) {
    return { ...mapping, state: 'needs-review', revision: mapping.revision + 1, updatedAt: now, explanation: `${mapping.explanation} Low confidence was not approved automatically.` };
  }
  return { ...mapping, state, revision: mapping.revision + 1, updatedAt: now };
}

function snapshot(studio: StudioDocument): StudioDocument {
  const slice = sliceOf(studio);
  return { ...studio, undo: [...studio.undo, slice].slice(-UNDO_LIMIT), redo: [] };
}

function undo(studio: StudioDocument): StudioDocument {
  const previous = studio.undo.at(-1);
  if (!previous) return studio;
  return { ...studio, ...previous, undo: studio.undo.slice(0, -1), redo: [...studio.redo, sliceOf(studio)].slice(-UNDO_LIMIT), updatedAt: new Date().toISOString() };
}

function redo(studio: StudioDocument): StudioDocument {
  const next = studio.redo.at(-1);
  if (!next) return studio;
  return { ...studio, ...next, redo: studio.redo.slice(0, -1), undo: [...studio.undo, sliceOf(studio)].slice(-UNDO_LIMIT), updatedAt: new Date().toISOString() };
}

function sliceOf(studio: StudioDocument): StudioSlice {
  return {
    roles: studio.roles,
    mappings: studio.mappings,
    uploads: studio.uploads,
    derived: studio.derived,
    mascotUploadId: studio.mascotUploadId,
  };
}

function roleFor(manifestAssetId: string, role: AssetRole, inferred: boolean, confidence: number, reason: string, scope: ScopeDecision): ReferenceRole {
  return { manifestAssetId, role, roleInferred: inferred, confidence, reason, containsText: 'unknown', scope };
}

function blankMapping(manifestAssetId: string, now: string): MappingRecord {
  return {
    id: `map-${manifestAssetId}`,
    manifestAssetId,
    uploadId: null,
    derivedId: null,
    state: 'not-mapped',
    confidence: 0,
    explanation: 'Not mapped.',
    placement: 'use-upload',
    overrides: {},
    revision: 0,
    updatedAt: now,
  };
}

function note(studio: StudioDocument, at: string, action: string, detail: string) {
  studio.history = [...studio.history, { at, action, detail }].slice(-80);
}

export function mascotChecklist(studio: StudioDocument, catalog: CatalogItem[]) {
  const watched = new Set(['main-mascot', 'logo', 'hero-banner', 'section-artwork', 'animated-gif', 'video-poster', 'background']);
  return catalog.flatMap((item) => {
    const role = studio.roles.find((entry) => entry.manifestAssetId === item.manifestAssetId);
    if (!role || !watched.has(role.role)) return [];
    const mapping = studio.mappings.find((entry) => entry.manifestAssetId === item.manifestAssetId);
    const covered = Boolean(mapping && ((mapping.uploadId && mapping.state !== 'not-mapped' && mapping.state !== 'rejected') || (mapping.placement === 'custom-artwork' && mapping.state === 'approved') || (mapping.placement === 'preserve-original' && role.scope === 'preserve')));
    return [{ manifestAssetId: item.manifestAssetId, filename: item.filename, role: role.role, covered, placement: mapping?.placement || 'use-upload', state: mapping?.state || 'not-mapped' }];
  });
}

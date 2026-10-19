import { NextResponse } from 'next/server';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { HttpError } from '@/lib/http/errors';
import { projects } from '@/lib/projects/store';
import { openIdentity, readRevision, saveIdentity, writeRevision } from '@/lib/identity/disk';
import { assertIdentityShape, blockingIssue, duplicateSection, fillSuggestions, normalizeIdentity, reorderSections, restoreSection, setTone } from '@/lib/identity/document';
import type { IdentityDocument, Tone } from '@/lib/identity/model';
import { emptyIdentity, TONES } from '@/lib/identity/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const opened = openIdentity(projects(), id);
    if (!opened) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    const revisionId = new URL(request.url).searchParams.get('revision');
    const revision = revisionId ? readRevision(opened.dir, revisionId) : null;
    return cors(request, NextResponse.json({ ...opened, project: opened.project, revision, dir: undefined, scan: undefined, studio: undefined, analysis: undefined }));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Identity failed' }, { status: 400 }));
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'identity');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const opened = openIdentity(store, id);
    if (!opened) return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
    if (opened.project.demo) throw new HttpError(400, 'Demo projects cannot be edited.');
    const body = await request.json() as { action?: string; document?: IdentityDocument; label?: string; revisionId?: string; sectionId?: string; ids?: string[]; tone?: Tone; word?: string; field?: string };
    if ((body.action === 'save' || body.action === 'revision') && body.document?.updatedAt && body.document.updatedAt !== opened.identity.updatedAt) {
      throw new HttpError(409, 'This identity changed since you loaded it. Reload, then save again.');
    }
    let next = opened.identity;
    if (body.action === 'save' && body.document) next = body.document;
    else if (body.action === 'revision') {
      const snapshot = body.document ? normalizeIdentity({ ...body.document, projectId: id, revisions: opened.identity.revisions }) : opened.identity;
      const blocked = blockingIssue(snapshot);
      if (blocked) throw new HttpError(400, blocked);
      next = writeRevision(opened.dir, snapshot, body.label || 'Manual save');
    }
    else if (body.action === 'restore' && body.revisionId) {
      const snapshot = readRevision(opened.dir, body.revisionId);
      if (!snapshot) throw new HttpError(404, 'That revision is not stored');
      next = { ...snapshot, projectId: id, revisions: opened.identity.revisions };
    } else if (body.action === 'duplicate-section' && body.sectionId) next = duplicateSection(opened.identity, body.sectionId);
    else if (body.action === 'restore-section' && body.sectionId) next = restoreSection(opened.identity, body.sectionId, opened.analysis);
    else if (body.action === 'reorder' && body.ids) next = reorderSections(opened.identity, body.ids);
    else if (body.action === 'tone' && body.tone) {
      if (!TONES.some((item) => item.id === body.tone)) throw new HttpError(400, 'Unknown tone preset');
      next = setTone(opened.identity, body.tone);
    } else if (body.action === 'suggest') next = fillSuggestions(opened.identity);
    else if (body.action === 'exception' && body.word) next = { ...opened.identity, exceptions: [...opened.identity.exceptions, body.word].slice(0, 40) };
    else if (body.action === 'approve-field' && body.field) next = { ...opened.identity, approvedFields: [...new Set([...opened.identity.approvedFields, body.field])] };
    else if (body.action === 'reset-field' && body.field) next = resetField(opened.identity, body.field);
    else if (body.action === 'import' && body.document) {
      const imported = normalizeIdentity(assertIdentityShape(body.document));
      next = { ...imported, projectId: id, revisions: opened.identity.revisions, referenceTitle: opened.identity.referenceTitle, referenceUrl: opened.identity.referenceUrl };
    } else throw new HttpError(400, 'Unknown identity action');
    const saved = saveIdentity(store, id, next);
    return cors(request, NextResponse.json({ ...saved, dir: undefined, scan: undefined, studio: undefined, analysis: undefined }));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 400;
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Identity update failed' }, { status }));
  }
}

function resetField(doc: IdentityDocument, field: string): IdentityDocument {
  const blank = emptyIdentity(doc.projectId);
  const next = structuredClone(doc);
  if (field.startsWith('token.') || field.startsWith('tokenomics.') || field.startsWith('narrative.') || field.startsWith('seo.')) {
    const [group, key] = field.split('.');
    const source = (blank as unknown as Record<string, Record<string, string>>)[group];
    const target = (next as unknown as Record<string, Record<string, string>>)[group];
    if (source && target && key in source) target[key] = source[key];
    return next;
  }
  throw new Error('That field cannot be reset.');
}

import { NextResponse } from 'next/server';
import { compareAnalyses } from '@/lib/analyze/interpret';
import { authorize, cors, preflight } from '@/lib/http/guard';
import { projects } from '@/lib/projects/store';
import type { AssetMapping, SectionRecord } from '@/lib/analyze/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS(request: Request) {
  return preflight(request);
}

function missing(request: Request) {
  return cors(request, NextResponse.json({ error: 'Unknown project' }, { status: 404 }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read', { auth: false });
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const project = store.get(id);
    if (!project) return missing(request);
    const url = new URL(request.url);
    const left = url.searchParams.get('left');
    const right = url.searchParams.get('right');
    if (left && right) {
      const older = store.readAnalysis(id, left);
      const newer = store.readAnalysis(id, right);
      if (!older || !newer) return cors(request, NextResponse.json({ error: 'Those versions are not available' }, { status: 404 }));
      return cors(request, NextResponse.json({ left: older, right: newer, diff: compareAnalyses(older, newer) }));
    }
    return cors(request, NextResponse.json({
      project,
      scan: store.readScan(id),
      analysis: store.readAnalysis(id),
    }));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown project' }, { status: 404 }));
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'read');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const store = projects();
    const project = store.get(id);
    if (!project) return missing(request);
    const body = await request.json() as { name?: string; section?: Partial<SectionRecord> & { id: string }; mapping?: { id: string; sectionId: string | null } };
    if (typeof body.name === 'string' && body.name.trim()) store.update(id, { name: body.name.trim().slice(0, 120) });
    if (body.section?.id || body.mapping?.id) {
      const analysis = store.readAnalysis(id);
      if (!analysis) return cors(request, NextResponse.json({ error: 'Analyze the project before correcting it' }, { status: 404 }));
      if (body.section?.id) {
        analysis.sections = analysis.sections.map((section) => correctSection(section, body.section!));
      }
      if (body.mapping?.id) {
        const sectionIds = new Set(analysis.sections.map((section) => section.id));
        if (body.mapping.sectionId && !sectionIds.has(body.mapping.sectionId)) {
          return cors(request, NextResponse.json({ error: 'That section is not in this blueprint' }, { status: 400 }));
        }
        analysis.assetMap = analysis.assetMap.map((asset) => correctMapping(asset, body.mapping!));
        for (const section of analysis.sections) {
          section.assetIds = analysis.assetMap.filter((asset) => asset.sectionId === section.id).map((asset) => asset.id);
        }
      }
      store.replaceCurrent(id, analysis);
    }
    return cors(request, NextResponse.json({ project: store.get(id), analysis: store.readAnalysis(id) }));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Update failed' }, { status: 400 }));
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = authorize(request, 'scan');
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    projects().remove(id);
    return cors(request, NextResponse.json({ ok: true }));
  } catch (error) {
    return cors(request, NextResponse.json({ error: error instanceof Error ? error.message : 'Delete failed' }, { status: 404 }));
  }
}

function correctSection(section: SectionRecord, patch: Partial<SectionRecord> & { id: string }): SectionRecord {
  if (section.id !== patch.id) return section;
  const height = Number(patch.height);
  const y = Number(patch.y);
  return {
    ...section,
    role: typeof patch.role === 'string' && patch.role.trim() ? patch.role.trim().slice(0, 40) : section.role,
    name: typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim().slice(0, 120) : section.name,
    y: Number.isFinite(y) ? y : section.y,
    height: Number.isFinite(height) && height > 0 ? height : section.height,
    corrected: true,
    roleInferred: false,
    confidence: 1,
  };
}

function correctMapping(asset: AssetMapping, patch: { id: string; sectionId: string | null }): AssetMapping {
  if (asset.id !== patch.id) return asset;
  return { ...asset, sectionId: patch.sectionId, corrected: true };
}

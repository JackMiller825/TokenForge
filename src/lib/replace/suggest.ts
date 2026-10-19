import type { CatalogItem, MappingRecord, UploadedAsset } from './model';
import { aspectDelta, aspectLabel, aspectsCompatible } from './ratio';

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/\.[a-z0-9]+$/i, '').split(/[^a-z0-9]+/).filter((part) => part.length > 2));
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

export interface Suggestion {
  uploadId: string;
  confidence: number;
  explanation: string;
}

export function suggestFor(item: CatalogItem, role: string, uploads: UploadedAsset[]): Suggestion | null {
  let best: Suggestion | null = null;
  const nameTokens = tokens(item.filename);
  for (const upload of uploads) {
    const parts: string[] = [];
    let score = 0;
    if (upload.role === role && role !== 'other') {
      score += 0.42;
      parts.push(`both labeled ${role}`);
    }
    const delta = aspectDelta(item.width, item.height, upload.width, upload.height);
    if (aspectsCompatible(delta)) {
      score += 0.36;
      parts.push(`compatible ${aspectLabel(item.width, item.height)} aspect ratio`);
    } else if (delta != null && delta <= 0.2) {
      score += 0.16;
      parts.push(`close aspect ratio, ${Math.round(delta * 100)}% apart`);
    } else if (delta != null) {
      parts.push(`aspect ratio differs by ${Math.round(delta * 100)}%`);
    }
    const nameScore = overlap(nameTokens, tokens(upload.originalFilename));
    if (nameScore > 0) {
      score += Math.min(0.16, nameScore);
      parts.push('filenames share words');
    }
    if (item.sectionRole && upload.role === 'section-artwork') {
      score += 0.06;
      parts.push(`placed in ${item.sectionRole}`);
    }
    score = Math.min(0.98, Math.round(score * 100) / 100);
    if (!parts.length) continue;
    const explanation = `${item.filename} · ${role} · ${upload.originalFilename} · ${parts.join('; ')}`;
    if (!best || score > best.confidence) best = { uploadId: upload.id, confidence: score, explanation };
  }
  if (!best || best.confidence < 0.45) return null;
  return best;
}

export function applySuggestion(mapping: MappingRecord, suggestion: Suggestion, now: string): MappingRecord {
  return {
    ...mapping,
    uploadId: suggestion.uploadId,
    derivedId: null,
    state: 'suggested',
    confidence: suggestion.confidence,
    explanation: suggestion.explanation,
    placement: 'use-upload',
    revision: mapping.revision + 1,
    updatedAt: now,
  };
}

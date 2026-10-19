'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, File, FileCode, FileText, Image as ImageIcon, Music, Type, Video } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { AssetRecord, Category } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const ICONS = { images: ImageIcon, videos: Video, fonts: Type, audio: Music, styles: FileCode, scripts: FileCode, documents: FileText, other: File };

export function Gallery({
  assets,
  selected,
  paths,
  previewFor,
  onToggle,
  onOpen,
}: {
  assets: AssetRecord[];
  selected: string[];
  paths: Map<string, string>;
  previewFor: (asset: AssetRecord) => string | null;
  onToggle: (id: string) => void;
  onOpen: (asset: AssetRecord) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const pages = Math.max(1, Math.ceil(assets.length / pageSize));
  const current = Math.min(page, pages);
  const visible = assets.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div>
      <div data-testid="asset-grid" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((asset) => {
          const Icon = ICONS[asset.category];
          const preview = previewFor(asset);
          const path = asset.outputPath || paths.get(asset.id);
          const name = path?.split('/').pop() || asset.savedFilename;
          return (
            <article key={asset.id} className="overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-[#465266]">
              <button type="button" className="block w-full text-left" onClick={() => onOpen(asset)}>
                <div className="relative flex aspect-[16/10] items-center justify-center bg-panel-2">
                  {preview && asset.category === 'images' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-full w-full object-contain" />
                  ) : preview && asset.category === 'videos' ? (
                    <video className="h-full w-full object-contain" src={preview} muted preload="metadata" />
                  ) : (
                    <Icon className="text-lime" size={28} />
                  )}
                  {asset.status === 'failed' && <span className="absolute left-3 top-3 rounded-md bg-red-950 px-2 py-1 text-[11px] text-red-200">Failed</span>}
                  {asset.filenameInferred && <span className="absolute right-3 top-3 rounded-md border border-line bg-ink/80 px-2 py-1 text-[11px] text-muted">Inferred</span>}
                </div>
              </button>
              <div className="flex items-start gap-3 p-3">
                <input className="mt-1" type="checkbox" checked={selected.includes(asset.id)} onChange={() => onToggle(asset.id)} aria-label={`Select ${name}`} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(asset)}>
                  <div className="truncate text-sm font-semibold" title={name}>{name}</div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="uppercase tracking-wide">{asset.category}</span>
                    <span>{formatBytes(asset.bytes)}</span>
                  </div>
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!assets.length && <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center text-sm text-muted">No assets match these filters.</div>}
      {assets.length > pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, assets.length)} of {assets.length}</span>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => setPage(Math.max(1, current - 1))} disabled={current === 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span className="px-2 py-2 text-muted">{current} / {pages}</span>
            <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => setPage(Math.min(pages, current + 1))} disabled={current === pages} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function categoryIcon(category: Category) {
  return ICONS[category];
}

export const ALL_CATEGORIES = CATEGORIES;

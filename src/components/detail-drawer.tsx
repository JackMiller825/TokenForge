'use client';

import { useEffect, useState } from 'react';
import { Copy, X } from 'lucide-react';
import { formatBytes } from '@/lib/format';
import type { AssetRecord } from '@/lib/types';

export function DetailDrawer({
  asset,
  path,
  preview,
  onClose,
}: {
  asset: AssetRecord;
  path?: string;
  preview: string | null;
  onClose: () => void;
}) {
  const [fontReady, setFontReady] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!preview || asset.category !== 'fonts') return;
    const family = `TokenForgePreview-${asset.id}`;
    let active = true;
    const face = new FontFace(family, `url(${preview})`);
    face.load().then((loaded) => {
      if (!active) return;
      document.fonts.add(loaded);
      setFontReady(family);
    }).catch(() => setFontReady(''));
    return () => {
      active = false;
      document.fonts.delete(face);
    };
  }, [asset.category, asset.id, preview]);

  const rows: Array<[string, string]> = [
    ['Saved filename', path?.split('/').pop() || asset.savedFilename],
    ['Original filename', asset.originalFilename || 'Not present in the source URL'],
    ['Name source', asset.filenameInferred ? 'Inferred from the response type' : 'Taken from the source URL'],
    ['Output path', path || 'Assigned when the archive is built'],
    ['Category', asset.category],
    ['MIME type', asset.mimeType || 'Unknown until download'],
    ['Extension', asset.extension || 'None'],
    ['Size', formatBytes(asset.bytes)],
    ['Dimensions', asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'Not available'],
    ['Content hash', asset.contentHash || 'Calculated during download'],
    ['Discovery', asset.discoveryMethod],
    ['Status', asset.status || 'pending'],
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/55" role="presentation" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label="Asset details" className="h-full w-full max-w-xl overflow-auto border-l border-line bg-ink p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">Asset</div>
            <h2 className="mt-2 break-all text-2xl font-semibold">{path?.split('/').pop() || asset.savedFilename}</h2>
          </div>
          <button type="button" className="rounded-lg border border-line p-2" onClick={onClose} aria-label="Close details"><X size={18} /></button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-panel">
          {preview && asset.category === 'images' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-80 w-full object-contain bg-panel-2" />
          )}
          {preview && asset.category === 'videos' && <video className="max-h-80 w-full bg-black" controls src={preview} />}
          {preview && asset.category === 'audio' && <audio className="w-full p-4" controls src={preview} />}
          {asset.category === 'fonts' && (
            <div className="p-6 text-3xl" style={{ fontFamily: fontReady || 'inherit' }}>
              {fontReady ? 'The quick brown fox jumps over the lazy dog.' : 'Loading font preview…'}
            </div>
          )}
          {!preview && <div className="px-5 py-8 text-sm text-muted">Scripts, styles, and documents are listed for reference and are not executed in this app.</div>}
        </div>
        <dl className="mt-5 space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-1 gap-1 border-b border-line/70 pb-3 sm:grid-cols-[160px_1fr]">
              <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
              <dd className="break-all text-sm">{value}</dd>
            </div>
          ))}
        </dl>
        {asset.error && <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">{asset.error}</div>}
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted">Source URL</div>
          <div className="mt-2 flex items-start gap-2">
            <code className="block flex-1 break-all rounded-xl border border-line bg-panel px-3 py-3 font-mono text-xs">{asset.sourceUrl}</code>
            <button type="button" className="rounded-xl border border-line p-3" aria-label="Copy source URL" onClick={() => { void navigator.clipboard.writeText(asset.sourceUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }}>
              <Copy size={16} />
            </button>
          </div>
          {copied && <div className="mt-2 text-xs text-lime">Copied</div>}
        </div>
        <div className="mt-4 text-sm text-muted">Referenced by {asset.references.length} discovery {asset.references.length === 1 ? 'point' : 'points'}.</div>
      </aside>
    </div>
  );
}

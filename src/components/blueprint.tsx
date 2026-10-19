'use client';

import { useMemo, useState } from 'react';
import { apiUrl } from '@/lib/api/client';
import type { AnalysisResult, AssetMapping, SectionRecord } from '@/lib/analyze/model';

const ROLES = ['header', 'navigation', 'hero', 'content', 'gallery', 'panel', 'token', 'community', 'footer', 'sticky', 'unknown'];

export function BlueprintView({ analysis, projectId, onCorrect }: { analysis: AnalysisResult; projectId?: string; onCorrect?: (body: Record<string, unknown>) => void }) {
  const [viewport, setViewport] = useState('desktop');
  const [selected, setSelected] = useState(analysis.sections[0]?.id || '');
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(0);
  const section = analysis.sections.find((item) => item.id === selected) || analysis.sections[0];
  const shots = analysis.screenshots.filter((shot) => shot.viewport === viewport);
  const full = shots.find((shot) => shot.kind === 'full-page');
  const pageSize = 12;
  const visible = analysis.sections.slice(page * pageSize, page * pageSize + pageSize);
  const assets = analysis.assetMap.filter((asset) => !section || asset.sectionId === section.id);
  const motions = [...analysis.animations, ...analysis.interactions].filter((item) => !section || item.sectionId === section.id || item.sectionId == null);
  const height = full?.height || 1100;
  const src = full && projectId && !analysis.demo ? apiUrl(`/api/projects/${projectId}/file?path=${encodeURIComponent(full.file)}`) : '';

  const swatches = useMemo(() => analysis.designSystem.colors.slice(0, 8), [analysis]);

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr_300px]">
      <section className="rounded-3xl border border-line bg-panel p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">Sections</div>
        <p className="mt-2 text-xs leading-5 text-muted">Roles marked inferred are guesses from layout and text. Correct them when the guess is wrong.</p>
        <ul className="mt-3 space-y-2" role="listbox" aria-label="Detected sections">
          {visible.map((item) => (
            <li key={item.id}>
              <button type="button" role="option" aria-selected={item.id === section?.id} onClick={() => setSelected(item.id)} className={`w-full rounded-2xl border px-3 py-3 text-left ${item.id === section?.id ? 'border-lime' : 'border-line'}`}>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="mt-1 text-xs text-muted">{item.role}{item.roleInferred ? ' · inferred' : ''} · {Math.round(item.confidence * 100)}%</div>
              </button>
            </li>
          ))}
        </ul>
        {analysis.sections.length > pageSize && (
          <div className="mt-3 flex justify-between text-xs">
            <button type="button" className="rounded-lg border border-line px-2 py-1" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <button type="button" className="rounded-lg border border-line px-2 py-1" disabled={(page + 1) * pageSize >= analysis.sections.length} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {['desktop', 'tablet', 'mobile'].map((item) => (
              <button key={item} type="button" onClick={() => setViewport(item)} className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${viewport === item ? 'border-lime text-lime' : 'border-line'}`}>{item}</button>
            ))}
          </div>
          <div className="flex gap-2 text-sm">
            <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom(1)}>Fit</button>
            <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom((value) => Math.min(2, value + 0.2))}>+</button>
            <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))}>−</button>
          </div>
        </div>
        {analysis.demo && <p className="mt-3 rounded-2xl border border-sky-800 bg-sky-950/40 px-3 py-2 text-sm text-sky-100">Demo mode. This wireframe is sample data, not a screenshot of a website.</p>}
        <div className="mt-3 max-h-[720px] overflow-auto rounded-2xl border border-line bg-ink">
          <div className="relative mx-auto origin-top-left" style={{ width: viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : '100%', transform: `scale(${zoom})` }}>
            {src ? <img src={src} alt={`${viewport} full page`} className="block w-full" /> : <Wireframe sections={analysis.sections} selected={section?.id} />}
            {src && section && full && (
              <button type="button" className="absolute border-2 border-lime bg-lime/15" style={{ left: `${(section.x / (full.width || 1)) * 100}%`, top: `${(section.y / height) * 100}%`, width: `${(section.width / (full.width || 1)) * 100}%`, height: `${(section.height / height) * 100}%` }} aria-label={section.name} />
            )}
          </div>
        </div>
        {full?.partial && <p className="mt-2 text-xs text-amber-200">{full.note || 'This capture is partial.'}</p>}
      </section>

      <aside className="space-y-4">
        {section && (
          <section className="rounded-3xl border border-line bg-panel p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">Section</div>
            <h2 className="mt-2 text-lg font-semibold">{section.name}</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Confidence" value={section.corrected ? 'Corrected by you' : `${Math.round(section.confidence * 100)}%${section.roleInferred ? ' · inferred' : ''}`} />
              <Row label="Box" value={`${section.width} × ${section.height} at ${section.x}, ${section.y}`} />
              <Row label="Layout" value={`${section.layout} · ${section.position}`} />
              <Row label="Selector" value={section.selector} />
            </dl>
            {onCorrect && (
              <form className="mt-3 space-y-2" onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                onCorrect({ section: { id: section.id, role: String(data.get('role')), name: String(data.get('name')), y: Number(data.get('y')), height: Number(data.get('height')) } });
              }}>
                <select name="role" defaultValue={section.role} className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" aria-label="Section role">
                  {ROLES.map((role) => <option key={role}>{role}</option>)}
                </select>
                <input name="name" defaultValue={section.name} className="w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" aria-label="Section name" />
                <div className="grid grid-cols-2 gap-2">
                  <input name="y" type="number" defaultValue={section.y} className="rounded-xl border border-line bg-ink px-3 py-2 text-sm" aria-label="Section top" />
                  <input name="height" type="number" defaultValue={section.height} className="rounded-xl border border-line bg-ink px-3 py-2 text-sm" aria-label="Section height" />
                </div>
                <button className="rounded-xl border border-line px-3 py-2 text-sm" type="submit">Save correction</button>
              </form>
            )}
          </section>
        )}
        <section className="rounded-3xl border border-line bg-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">Assets in section</div>
          <ul className="mt-3 space-y-2">
            {assets.map((asset) => <AssetRow key={asset.id} asset={asset} sections={analysis.sections} onCorrect={onCorrect} />)}
            {!assets.length && <li className="text-sm text-muted">No mapped assets in this section.</li>}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">Observed motion</div>
          <ul className="mt-3 space-y-2 text-sm">
            {motions.map((motion) => (
              <li key={motion.id} className="rounded-2xl border border-line px-3 py-2">
                <div className="font-semibold">{motion.kind}</div>
                <div className="text-xs text-muted">{motion.trigger}{motion.duration ? ` · ${motion.duration}` : ''} · {Math.round(motion.confidence * 100)}%</div>
                {motion.limitation && <div className="mt-1 text-xs text-muted">{motion.limitation}</div>}
              </li>
            ))}
            {!motions.length && <li className="text-muted">No observable motion in this section.</li>}
          </ul>
        </section>
        <section className="rounded-3xl border border-line bg-panel p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">Observed colors</div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {swatches.map((color) => (
              <div key={color.value} className="text-[10px] text-muted">
                <div className="h-8 rounded-lg border border-line" style={{ background: color.value }} />
                <div className="mt-1 truncate">{color.value}</div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function AssetRow({ asset, sections, onCorrect }: { asset: AssetMapping; sections: SectionRecord[]; onCorrect?: (body: Record<string, unknown>) => void }) {
  return (
    <li className="rounded-2xl border border-line px-3 py-2 text-sm">
      <div className="font-semibold">{asset.kind}</div>
      <div className="truncate text-xs text-muted">{asset.resolvedUrl}</div>
      <div className="mt-1 text-xs text-muted">{asset.match === 'none' ? 'No Phase 1 file matched' : `Matched ${asset.match}`}</div>
      {onCorrect && (
        <select className="mt-2 w-full rounded-lg border border-line bg-ink px-2 py-1 text-xs" aria-label="Move asset to section" value={asset.sectionId || ''} onChange={(event) => onCorrect({ mapping: { id: asset.id, sectionId: event.target.value || null } })}>
          <option value="">Unassigned</option>
          {sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-wide text-muted">{label}</dt><dd className="break-all">{value}</dd></div>;
}

function Wireframe({ sections, selected }: { sections: SectionRecord[]; selected?: string }) {
  const height = Math.max(...sections.map((section) => section.y + section.height), 640);
  return (
    <div className="relative bg-[#0c1016]" style={{ height }}>
      {sections.map((section) => (
        <div key={section.id} className={`absolute border ${section.id === selected ? 'border-lime bg-lime/10' : 'border-line bg-panel-2/70'}`} style={{ left: 16, right: 16, top: section.y * 0.45, height: Math.max(48, section.height * 0.45) }}>
          <div className="p-3 text-sm">{section.name}<div className="text-xs text-muted">{section.role}{section.roleInferred ? ' · inferred' : ''}</div></div>
        </div>
      ))}
    </div>
  );
}

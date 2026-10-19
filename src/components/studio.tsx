'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api/client';
import type { AssetRole, CatalogItem, MappingState, ScopeDecision, StudioDocument } from '@/lib/replace/model';
import { ASSET_ROLES } from '@/lib/replace/model';

interface Issue { severity: string; message: string; manifestAssetId?: string }
interface Shot { file: string; viewport: string; kind: string; width: number; height: number }
interface Check { manifestAssetId: string; filename: string; role: string; covered: boolean; state: string }
interface StudioPayload {
  project: { id: string; name: string; url: string };
  studio: StudioDocument;
  catalog: CatalogItem[];
  readiness: { percent: number; ready: boolean; total: number; inScope: number; approved: number; missing: number; customArtwork: number; preserved: number; issues: Issue[] };
  sections: { id: string; name: string; role: string }[];
  screenshots: Shot[];
  checklist: Check[];
}

const SCOPES: ScopeDecision[] = ['replace', 'preserve', 'omit', 'not-applicable'];

export function StudioWorkspace({ projectId }: { projectId: string }) {
  const [data, setData] = useState<StudioPayload | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('visual');
  const [page, setPage] = useState(0);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [viewport, setViewport] = useState('desktop');
  const [slider, setSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [checked, setChecked] = useState<string[]>([]);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState('');

  async function load() {
    const response = await fetch(apiUrl(`/api/projects/${projectId}/studio`), { headers: authHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'The studio could not be opened');
    setData(body);
    const preferred = ['images', 'videos', 'fonts'].map((category) => body.catalog.find((entry: CatalogItem) => entry.category === category)).find(Boolean);
    setSelected((current) => current || preferred?.manifestAssetId || body.catalog[0]?.manifestAssetId || '');
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'The studio could not be opened'));
  }, [projectId]);

  async function patch(action: Record<string, unknown>) {
    setError('');
    const response = await fetch(apiUrl(`/api/projects/${projectId}/studio`), { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify(action) });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'The change was not saved');
      return;
    }
    setData(body);
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = [...files];
    setBusy(`Uploading 0 of ${list.length}`);
    for (let index = 0; index < list.length; index += 1) {
      setBusy(`Uploading ${index + 1} of ${list.length}`);
      const form = new FormData();
      form.append('file', list[index]);
      const response = await fetch(apiUrl(`/api/projects/${projectId}/studio/upload`), { method: 'POST', headers: authHeaders(), body: form });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error || 'Upload failed');
        setBusy('');
        return;
      }
      setData(body);
    }
    setBusy('');
  }

  async function derive(presetId?: string) {
    if (!data || !selected) return;
    const mapping = data.studio.mappings.find((item) => item.manifestAssetId === selected);
    const uploadId = mapping?.uploadId || data.studio.mascotUploadId || data.studio.uploads[0]?.id;
    if (!uploadId) {
      setError('Upload a replacement before creating a variant.');
      return;
    }
    setBusy('Creating a variant');
    const response = await fetch(apiUrl(`/api/projects/${projectId}/studio/derive`), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ uploadId, manifestAssetId: selected, presetId, focalX: mapping?.overrides.focalX, focalY: mapping?.overrides.focalY }),
    });
    const body = await response.json();
    setBusy('');
    if (!response.ok) {
      setError(body.error || 'The variant failed');
      return;
    }
    setData(body);
  }

  async function exportPackage() {
    setBusy('Packing the replacement library');
    const response = await fetch(apiUrl(`/api/projects/${projectId}/studio/export`), { method: 'POST', headers: authHeaders(true) });
    const created = await response.json();
    if (!response.ok) {
      setBusy('');
      setError(created.error || 'Export failed');
      return;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const jobResponse = await fetch(apiUrl(`/api/jobs/${created.jobId}`), { headers: authHeaders() });
      const job = await jobResponse.json();
      if (job.status === 'completed' && job.download) {
        window.location.href = apiUrl(`/api/exports/${job.download.token}`);
        setBusy('');
        return;
      }
      if (job.status === 'failed') {
        setError(job.error || 'Export failed');
        setBusy('');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    setBusy('');
  }

  const visible = useMemo(() => {
    if (!data) return [];
    return data.catalog.filter((item) => {
      const role = data.studio.roles.find((entry) => entry.manifestAssetId === item.manifestAssetId);
      const mapping = data.studio.mappings.find((entry) => entry.manifestAssetId === item.manifestAssetId);
      if (query && !`${item.filename} ${item.url}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (roleFilter !== 'all' && role?.role !== roleFilter) return false;
      if (stateFilter !== 'all' && mapping?.state !== stateFilter) return false;
      if (sectionFilter !== 'all' && item.sectionId !== sectionFilter) return false;
      if (kindFilter === 'visual' && !['images', 'videos', 'fonts'].includes(item.category)) return false;
      if (kindFilter !== 'all' && kindFilter !== 'visual' && item.category !== kindFilter) return false;
      return true;
    }).sort((left, right) => {
      const order = ['images', 'videos', 'fonts'];
      const rank = (category: string) => {
        const index = order.indexOf(category);
        return index === -1 ? order.length : index;
      };
      return rank(left.category) - rank(right.category) || left.filename.localeCompare(right.filename);
    });
  }, [data, query, roleFilter, stateFilter, sectionFilter, kindFilter]);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const pageItems = visible.slice(page * pageSize, page * pageSize + pageSize);

  if (!data) return <p className="text-sm text-muted">{error || 'Opening the replacement studio.'}</p>;
  const item = data.catalog.find((entry) => entry.manifestAssetId === selected) || visible[0];
  const role = data.studio.roles.find((entry) => entry.manifestAssetId === item?.manifestAssetId);
  const mapping = data.studio.mappings.find((entry) => entry.manifestAssetId === item?.manifestAssetId);
  const upload = data.studio.uploads.find((entry) => entry.id === mapping?.uploadId);
  const derived = data.studio.derived.find((entry) => entry.id === mapping?.derivedId);
  const shot = data.screenshots.find((entry) => entry.viewport === viewport && entry.kind === 'full-page') || data.screenshots.find((entry) => entry.kind === 'full-page');
  const previewPath = derived?.relativePath || upload?.relativePath;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Asset replacement studio</div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">{data.project.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Original reference files stay untouched. Uploads and fitted variants are stored separately, so a mapping can be restored.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void patch({ action: 'undo' })}>Undo</button>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void patch({ action: 'redo' })}>Redo</button>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void patch({ action: 'suggest' })}>Suggest mappings</button>
          <button type="button" className="rounded-lg bg-lime px-3 py-2 text-sm font-semibold text-ink" onClick={() => void exportPackage()}>Export package</button>
        </div>
      </div>
      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm">{error}</div>}
      {busy && <p className="mt-3 text-sm text-muted" aria-live="polite">{busy}</p>}
      <Readiness readiness={data.readiness} />
      <div className="mt-5 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-4">
          <label className="block rounded-3xl border border-dashed border-line bg-panel p-4 text-sm" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files); }}>
            Drop replacements here or browse
            <input className="mt-3 block w-full text-xs" type="file" multiple accept="image/*,video/*,font/*,.woff,.woff2,.ttf,.otf,.svg" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.target.value = ''; }} />
          </label>
          <div className="rounded-3xl border border-line bg-panel p-4">
            <label className="block text-xs uppercase tracking-wide text-muted">Search
              <input className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <Select label="Role" value={roleFilter} onChange={(value) => { setRoleFilter(value); setPage(0); }} options={[['all', 'All roles'], ...ASSET_ROLES.map((roleName) => [roleName, roleName])]} />
            <Select label="Status" value={stateFilter} onChange={(value) => { setStateFilter(value); setPage(0); }} options={[['all', 'All statuses'], ['not-mapped', 'Not mapped'], ['suggested', 'Suggested'], ['mapped', 'Mapped'], ['needs-review', 'Needs review'], ['approved', 'Approved'], ['rejected', 'Rejected']]} />
            <Select label="Section" value={sectionFilter} onChange={(value) => { setSectionFilter(value); setPage(0); }} options={[['all', 'All sections'], ...data.sections.map((section) => [section.id, section.name])]} />
            <Select label="Media" value={kindFilter} onChange={(value) => { setKindFilter(value); setPage(0); }} options={[['visual', 'Images, video, fonts'], ['all', 'Every discovered file'], ['images', 'Images'], ['videos', 'Videos'], ['fonts', 'Fonts'], ['scripts', 'Scripts']]} />
            <div className="mt-3 flex gap-2">
              <button type="button" className={`rounded-lg border px-3 py-1 text-sm ${layout === 'grid' ? 'border-lime text-lime' : 'border-line'}`} onClick={() => setLayout('grid')}>Grid</button>
              <button type="button" className={`rounded-lg border px-3 py-1 text-sm ${layout === 'list' ? 'border-lime text-lime' : 'border-line'}`} onClick={() => setLayout('list')}>List</button>
            </div>
          </div>
          <ul className={layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'} role="listbox" aria-label="Reference assets">
            {pageItems.map((entry) => {
              const entryRole = data.studio.roles.find((roleEntry) => roleEntry.manifestAssetId === entry.manifestAssetId);
              const entryMapping = data.studio.mappings.find((mappingEntry) => mappingEntry.manifestAssetId === entry.manifestAssetId);
              return (
                <li key={entry.manifestAssetId}>
                  <button type="button" role="option" aria-selected={entry.manifestAssetId === item?.manifestAssetId} className={`w-full rounded-2xl border px-3 py-3 text-left ${entry.manifestAssetId === item?.manifestAssetId ? 'border-lime' : 'border-line bg-panel'}`} onClick={() => setSelected(entry.manifestAssetId)}>
                    <div className="text-sm font-semibold">{entry.filename}</div>
                    <div className="mt-1 text-xs text-muted">{entryRole?.role}{entryRole?.roleInferred ? ' · inferred' : ''} · {entryMapping?.state}</div>
                  </button>
                </li>
              );
            })}
          </ul>
          {!visible.length && <p className="text-sm text-muted">No reference assets match these filters.</p>}
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-xs">
              <button type="button" className="rounded-lg border border-line px-2 py-1" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span className="text-muted">{page + 1} / {pageCount}</span>
              <button type="button" className="rounded-lg border border-line px-2 py-1" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          )}
        </aside>
        <section className="rounded-3xl border border-line bg-panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              {['desktop', 'tablet', 'mobile'].map((name) => <button key={name} type="button" className={`rounded-lg border px-3 py-1 text-sm capitalize ${viewport === name ? 'border-lime text-lime' : 'border-line'}`} onClick={() => setViewport(name)}>{name}</button>)}
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom(1)}>Fit</button>
              <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom((value) => Math.min(2, value + 0.2))}>+</button>
              <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => setZoom((value) => Math.max(0.4, value - 0.2))}>−</button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">This is a screenshot mockup with an asset overlay. It is not a rebuilt webpage and it is not proof the generated site will match pixel for pixel.</p>
          <div className="mt-3 max-h-[640px] overflow-auto rounded-2xl border border-line bg-ink">
            <div className="relative origin-top-left" style={{ transform: `scale(${zoom})` }}>
              {shot ? <img src={apiUrl(`/api/projects/${projectId}/file?path=${encodeURIComponent(shot.file)}`)} alt={`${viewport} reference screenshot`} className="block w-full" /> : <div className="grid h-64 place-items-center text-sm text-muted">No screenshot for this viewport yet.</div>}
              {shot && item?.displayedWidth && item.displayedHeight && item.x != null && item.y != null ? <button type="button" className="absolute border-2 border-lime bg-lime/20" style={{ left: `${(item.x / shot.width) * 100}%`, top: `${(item.y / shot.height) * 100}%`, width: `${(item.displayedWidth / shot.width) * 100}%`, height: `${(item.displayedHeight / shot.height) * 100}%` }} aria-label={item.filename} /> : null}
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <figure className="rounded-2xl border border-line p-3">
              <figcaption className="text-xs uppercase tracking-wide text-muted">Reference</figcaption>
              <p className="mt-2 text-sm">{item?.filename || 'Nothing selected'}</p>
              <p className="text-xs text-muted">{item?.width || '—'} × {item?.height || '—'} · used {item?.usage || 0} time{(item?.usage || 0) === 1 ? '' : 's'}</p>
            </figure>
            <figure className="rounded-2xl border border-line p-3">
              <figcaption className="text-xs uppercase tracking-wide text-muted">Replacement</figcaption>
              {previewPath ? <img src={apiUrl(`/api/projects/${projectId}/file?path=${encodeURIComponent(previewPath)}`)} alt={upload?.originalFilename || 'Replacement preview'} className="mt-2 max-h-48 w-full object-contain" /> : <p className="mt-2 text-sm text-muted">No replacement mapped.</p>}
            </figure>
          </div>
          <label className="mt-4 block text-xs uppercase tracking-wide text-muted">Before / after
            <input className="mt-2 w-full" type="range" min={0} max={100} value={slider} aria-valuetext={`${slider} percent reference`} onChange={(event) => setSlider(Number(event.target.value))} />
          </label>
          <div className="relative mt-2 h-48 overflow-hidden rounded-2xl border border-line bg-ink">
            {previewPath && <img src={apiUrl(`/api/projects/${projectId}/file?path=${encodeURIComponent(previewPath)}`)} alt="" className="absolute inset-0 h-full w-full object-contain" />}
            {shot && <img src={apiUrl(`/api/projects/${projectId}/file?path=${encodeURIComponent(shot.file)}`)} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }} />}
          </div>
        </section>
        <aside className="space-y-4">
          {item && role && mapping && (
            <section className="rounded-3xl border border-line bg-panel p-4">
              <h2 className="text-lg font-semibold">{item.filename}</h2>
              <p className="mt-2 text-xs leading-5 text-muted">{role.reason}</p>
              <p className="mt-2 text-sm">{mapping.explanation}</p>
              <p className="mt-2 text-xs text-muted">Confidence {Math.round(mapping.confidence * 100)}% · {mapping.state} · revision {mapping.revision}</p>
              <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Role
                <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={role.role} aria-label="Asset role" onChange={(event) => void patch({ action: 'set-role', manifestAssetId: item.manifestAssetId, role: event.target.value })}>
                  {ASSET_ROLES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Scope
                <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={role.scope} aria-label="Replacement scope" onChange={(event) => void patch({ action: 'set-scope', manifestAssetId: item.manifestAssetId, scope: event.target.value })}>
                  {SCOPES.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Replacement
                <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={mapping.uploadId || ''} aria-label="Replacement file" onChange={(event) => void patch({ action: 'map', manifestAssetId: item.manifestAssetId, uploadId: event.target.value || null })}>
                  <option value="">Unmapped</option>
                  {data.studio.uploads.map((file) => <option key={file.id} value={file.id}>{file.originalFilename}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Placement
                <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={mapping.placement} aria-label="Placement action" onChange={(event) => void patch({ action: 'placement', manifestAssetId: item.manifestAssetId, placement: event.target.value })}>
                  {['use-upload', 'dedicated-scene', 'derived-variant', 'custom-artwork', 'preserve-original'].map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Object fit
                <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={mapping.overrides.objectFit || 'contain'} aria-label="Object fit" onChange={(event) => void patch({ action: 'override', manifestAssetId: item.manifestAssetId, objectFit: event.target.value })}>
                  <option value="contain">Contain</option>
                  <option value="cover">Cover</option>
                  <option value="fill">Fill</option>
                </select>
              </label>
              <label className="mt-3 block text-xs text-muted">Focal point X
                <input className="mt-1 w-full" type="range" min={0} max={100} value={Math.round((mapping.overrides.focalX ?? 0.5) * 100)} aria-label="Focal point horizontal" onChange={(event) => void patch({ action: 'override', manifestAssetId: item.manifestAssetId, focalX: Number(event.target.value) / 100 })} />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg bg-lime px-3 py-2 text-sm font-semibold text-ink" onClick={() => void patch({ action: 'state', manifestAssetId: item.manifestAssetId, state: 'approved' satisfies MappingState })}>Approve</button>
                <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void patch({ action: 'state', manifestAssetId: item.manifestAssetId, state: 'rejected' })}>Reject</button>
                <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void patch({ action: 'restore', manifestAssetId: item.manifestAssetId })}>Restore</button>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={checked.includes(mapping.id)} onChange={() => setChecked((current) => current.includes(mapping.id) ? current.filter((id) => id !== mapping.id) : [...current, mapping.id])} />
                Include in bulk approval
              </label>
              {upload && <p className="mt-3 text-xs leading-5 text-muted">{upload.originalFilename} · {upload.bytes} bytes · {upload.aspect || 'no ratio'} · {upload.hasAlpha ? 'transparency' : 'no transparency'} · {upload.animated ? 'animated' : 'still'} · {upload.contentHash.slice(0, 12)}</p>}
            </section>
          )}
          <section className="rounded-3xl border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold">Mascot checklist</h2>
            <p className="mt-2 text-xs leading-5 text-muted">One still mascot does not recreate every pose, scene, or animation. Mark anything that still needs its own artwork.</p>
            <ul className="mt-3 space-y-2 text-sm">
              {data.checklist.map((entry) => <li key={entry.manifestAssetId} className="flex justify-between gap-2"><span>{entry.filename}</span><span className="text-xs text-muted">{entry.covered ? 'covered' : 'needs art'} · {entry.role}</span></li>)}
              {!data.checklist.length && <li className="text-muted">No mascot-like placements yet.</li>}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.studio.presets.map((preset) => <button key={preset.id} type="button" className="rounded-lg border border-line px-2 py-1 text-xs" onClick={() => void derive(preset.id)}>{preset.name}</button>)}
            </div>
          </section>
          {confirmBulk ? (
            <div className="rounded-3xl border border-amber-800 bg-amber-950/30 p-4 text-sm">
              Approve {checked.length} selected mappings?
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-lg bg-lime px-3 py-2 font-semibold text-ink" onClick={() => { void patch({ action: 'bulk-approve', mappingIds: checked, confirm: true }); setConfirmBulk(false); }}>Confirm</button>
                <button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => setConfirmBulk(false)}>Cancel</button>
              </div>
            </div>
          ) : <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" disabled={!checked.length} onClick={() => setConfirmBulk(true)}>Bulk approve</button>}
          <ul className="space-y-1 text-xs text-muted">
            {data.studio.history.slice(-6).reverse().map((entry) => <li key={`${entry.at}-${entry.action}`}>{entry.action}: {entry.detail}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Readiness({ readiness }: { readiness: StudioPayload['readiness'] }) {
  return (
    <section className="mt-5 rounded-3xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{readiness.ready ? 'Ready for the next phase' : 'Replacement progress'}</h2>
        <div className="text-sm text-lime">{readiness.percent}% of the replace scope</div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink"><div className="h-full bg-lime" style={{ width: `${readiness.percent}%` }} /></div>
      <p className="mt-3 text-sm text-muted">{readiness.total} reference assets · {readiness.inScope} marked replace · {readiness.approved} approved · {readiness.missing} missing · {readiness.customArtwork} need custom artwork · {readiness.preserved} preserved</p>
      <ul className="mt-3 space-y-1 text-sm">
        {readiness.issues.slice(0, 6).map((issue) => <li key={issue.message} className={issue.severity === 'block' ? 'text-amber-100' : 'text-muted'}>{issue.message}</li>)}
      </ul>
    </section>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <label className="mt-3 block text-xs uppercase tracking-wide text-muted">{label}
      <select className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm normal-case" value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

export type { AssetRole };

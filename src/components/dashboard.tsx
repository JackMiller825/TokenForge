'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDownToLine, Check, Globe2, Layers, LoaderCircle, Search, ShieldCheck, X } from 'lucide-react';
import { planPaths } from '@/lib/archive/names';
import { downloadSampleZip, SAMPLE_SCAN } from '@/lib/demo/sample';
import { formatBytes, STATIC_EXPORT, withBase } from '@/lib/format';
import type { AssetRecord, Job, ScanMode, ScanResult, ZipStructure } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';
import { DetailDrawer } from './detail-drawer';
import { Gallery } from './gallery';

const MODES: Array<{ id: ScanMode; title: string; copy: string }> = [
  { id: 'quick', title: 'Quick', copy: 'First page, including lazy-loaded media.' },
  { id: 'deep', title: 'Deep', copy: 'Same-origin pages, within the page and depth limits.' },
  { id: 'full', title: 'Full', copy: 'Scrolls and safe clicks. No forms, wallets, or purchases.' },
];

function authHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export default function Dashboard() {
  const [url, setUrl] = useState('https://');
  const [mode, setMode] = useState<ScanMode>('quick');
  const [maxPages, setMaxPages] = useState(1);
  const [maxDepth, setMaxDepth] = useState(0);
  const [includeTrackers, setIncludeTrackers] = useState(false);
  const [structure, setStructure] = useState<ZipStructure>('organized');
  const [token, setToken] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [scanJob, setScanJob] = useState<Job | null>(null);
  const [exportJob, setExportJob] = useState<Job | null>(null);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState<AssetRecord | null>(null);
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | AssetRecord['category']>('all');
  const [size, setSize] = useState('all');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState<'scan' | 'export' | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('tokenforge-token');
    if (saved) setToken(saved);
    if (STATIC_EXPORT) return;
    void fetch(withBase('/api/health')).then((response) => response.json()).then((body) => setAuthRequired(Boolean(body.authRequired))).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!scanJob || ['completed', 'failed', 'cancelled'].includes(scanJob.status)) return undefined;
    return watch(scanJob.id, (job) => {
      setScanJob(job);
      if (job.result) {
        setScan(job.result);
        setDemo(false);
        if (job.status === 'completed') setSelected(job.result.assets.map((asset) => asset.id));
      }
      if (job.status === 'failed') setError(job.error || 'Scan failed');
      if (job.status !== 'running' && job.status !== 'queued') setBusy(null);
    });
  }, [scanJob?.id, scanJob?.status]);

  useEffect(() => {
    if (!exportJob || ['completed', 'failed', 'cancelled'].includes(exportJob.status)) return undefined;
    return watch(exportJob.id, (job) => {
      setExportJob(job);
      if (job.manifest && scan) {
        const updates = new Map(job.manifest.assets.map((asset) => [asset.id, asset]));
        setScan({ ...scan, assets: scan.assets.map((asset) => updates.get(asset.id) ?? asset), warnings: job.manifest.warnings });
      }
      if (job.status === 'completed' && job.download) {
        const link = document.createElement('a');
        link.href = withBase(`/api/exports/${job.download.token}`);
        link.download = job.download.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      if (job.status === 'failed') setError(job.error || 'Export failed');
      if (job.status !== 'running' && job.status !== 'queued') setBusy(null);
    });
  }, [exportJob?.id, exportJob?.status, scan]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (scan?.assets ?? []).filter((asset) => {
      if (category !== 'all' && asset.category !== category) return false;
      if (status !== 'all' && (asset.status || 'pending') !== status) return false;
      if (!matchesSize(asset.bytes, size)) return false;
      if (!needle) return true;
      return `${asset.savedFilename} ${asset.originalFilename ?? ''} ${asset.resolvedUrl} ${asset.mimeType ?? ''}`.toLowerCase().includes(needle);
    });
  }, [scan, query, category, size, status]);

  const paths = useMemo(() => planPaths(scan?.assets ?? [], selected, structure), [scan, selected, structure]);
  const counts = scan?.stats.byCategory;
  const failed = scan?.assets.filter((asset) => asset.status === 'failed') ?? [];
  const running = scanJob?.status === 'running' || scanJob?.status === 'queued' || exportJob?.status === 'running' || exportJob?.status === 'queued';

  function chooseMode(next: ScanMode) {
    setMode(next);
    if (next === 'deep') { setMaxPages(6); setMaxDepth(2); }
    if (next === 'full') { setMaxPages(3); setMaxDepth(1); }
    if (next === 'quick') { setMaxPages(1); setMaxDepth(0); }
  }

  async function startScan(event: React.FormEvent) {
    event.preventDefault();
    if (STATIC_EXPORT) {
      setError('GitHub Pages can show this dashboard, but scanning needs the TokenForge server. Use Load sample library here, or run npm start on a Node host.');
      return;
    }
    setBusy('scan');
    setError('');
    setScan(null);
    setSelected([]);
    setDemo(false);
    setExportJob(null);
    sessionStorage.setItem('tokenforge-token', token);
    try {
      const response = await fetch(withBase('/api/scan'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ url, mode, maxPages, maxDepth, includeTrackers }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Scan failed');
      setScanJob({ id: body.jobId, type: 'scan', status: body.status, createdAt: '', updatedAt: '', progress: body.progress });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Scan failed');
      setBusy(null);
    }
  }

  async function exportZip() {
    if (demo) {
      setError('');
      try { await downloadSampleZip(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sample export failed'); }
      return;
    }
    if (!scanJob) return;
    setBusy('export');
    setError('');
    try {
      const response = await fetch(withBase('/api/download'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ jobId: scanJob.id, selectedIds: selected, structure }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Export failed');
      setExportJob({ id: body.jobId, type: 'export', status: body.status, createdAt: '', updatedAt: '', progress: body.progress });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
      setBusy(null);
    }
  }

  function loadSample() {
    setDemo(true);
    setScan(SAMPLE_SCAN);
    setSelected(SAMPLE_SCAN.assets.map((asset) => asset.id));
    setScanJob(null);
    setExportJob(null);
    setError('');
    setActive(null);
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleCategory(cat: AssetRecord['category']) {
    const ids = (scan?.assets ?? []).filter((asset) => asset.category === cat).map((asset) => asset.id);
    const all = ids.every((id) => selected.includes(id));
    setSelected((current) => all ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]);
  }

  function selectVisible(on: boolean) {
    const ids = filtered.map((asset) => asset.id);
    setSelected((current) => on ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id)));
  }

  const previewFor = (asset: AssetRecord) => {
    if (demo) return asset.category === 'images' ? withBase(asset.sourceUrl) : null;
    if (!scanJob || !['images', 'videos', 'audio', 'fonts'].includes(asset.category)) return null;
    return withBase(`/api/preview?jobId=${encodeURIComponent(scanJob.id)}&assetId=${encodeURIComponent(asset.id)}`);
  };

  return (
    <div className="relative z-10 min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-ink"><Layers size={20} /></span>
            <span>TOKEN<span className="text-lime">FORGE</span></span>
            <span className="hidden rounded-md border border-line px-2 py-1 text-[11px] text-muted sm:inline">MODULE 01</span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="hidden items-center gap-2 md:flex"><ShieldCheck size={16} /> Reference assets</span>
            <Link href="/help" data-testid="help-link" className="rounded-lg border border-line px-3 py-2 text-sm text-[#e7edf6]">Help</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[320px_1fr] lg:py-8">
        <aside className="h-fit rounded-3xl border border-line bg-panel p-4 lg:sticky lg:top-24">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">Scan</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {MODES.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseMode(item.id)} className={`rounded-xl border px-2 py-3 text-sm font-semibold ${mode === item.id ? 'border-lime bg-lime text-ink' : 'border-line bg-panel-2'}`}>{item.title}</button>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted">{MODES.find((item) => item.id === mode)?.copy}</p>
          <label className="mt-4 block text-xs uppercase tracking-wide text-muted">Pages
            <input className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2" type="number" min={1} max={12} disabled={mode === 'quick'} value={maxPages} onChange={(event) => setMaxPages(Number(event.target.value))} />
          </label>
          <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Depth
            <input className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2" type="number" min={0} max={3} disabled={mode === 'quick'} value={maxDepth} onChange={(event) => setMaxDepth(Number(event.target.value))} />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTrackers} onChange={(event) => setIncludeTrackers(event.target.checked)} /> Include trackers</label>
          <div className="mt-4 text-xs uppercase tracking-wide text-muted">Archive layout</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['organized', 'source'] as const).map((item) => (
              <button key={item} type="button" onClick={() => setStructure(item)} className={`rounded-xl border px-3 py-2 text-sm ${structure === item ? 'border-lime text-lime' : 'border-line'}`}>{item === 'organized' ? 'Organized' : 'Source paths'}</button>
            ))}
          </div>
          {(authRequired || token) && (
            <label className="mt-4 block text-xs uppercase tracking-wide text-muted">Access token
              <input className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 font-mono text-xs" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
            </label>
          )}
          <button type="button" data-testid="sample-button" onClick={loadSample} className="mt-5 w-full rounded-xl border border-line px-4 py-3 text-sm font-semibold">Load sample library</button>
          <p className="mt-4 text-xs leading-5 text-muted">Limits: 25 MB per file, 160 MB per archive, 250 files. Quick scans stay on the first page.</p>
        </aside>

        <section>
          {STATIC_EXPORT && <div className="mb-4 rounded-2xl border border-lime/40 bg-lime/10 px-4 py-3 text-sm leading-6">This GitHub Pages deployment is a static preview. Live scanning runs on the TokenForge server because it needs Chromium. Load the sample library to review the gallery, or run the app with <span className="font-mono">npm start</span>.</div>}
          <div className="rise max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Reference intelligence</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Collect the reference.<br />Keep the filenames.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Scan a public website, review every discovered file, and export a ZIP whose names match the source — or are clearly marked when a name had to be inferred.</p>
          </div>

          <form className="mt-6 rounded-3xl border border-line bg-panel p-4 sm:p-5" onSubmit={(event) => void startScan(event)}>
            <label htmlFor="website" className="text-sm font-semibold">Reference website URL</label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-ink px-4">
                <Globe2 className="text-muted" size={18} />
                <input id="website" data-testid="url-input" required className="w-full bg-transparent py-4 text-sm outline-none" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/" />
              </div>
              <button data-testid="scan-button" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-lime px-6 py-4 font-semibold text-ink" disabled={busy !== null} type="submit">
                {busy === 'scan' ? <LoaderCircle className="animate-spin" size={18} /> : <Search size={18} />}
                {busy === 'scan' ? 'Scanning' : 'Scan website'}
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">Only scan sites you are allowed to collect from. TokenForge does not submit forms, connect wallets, or bypass access controls.</p>
          </form>

          {(scanJob || exportJob) && (
            <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2 w-2 rounded-full bg-lime ${running ? 'pulse' : ''}`} />{exportJob?.progress.message || scanJob?.progress.message}</div>
                {running && <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-xs" onClick={() => void fetch(withBase(`/api/jobs/${(exportJob ?? scanJob)!.id}/cancel`), { method: 'POST', headers: authHeaders(token) })}>Cancel</button>}
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink">
                <div className="h-full bg-lime transition-all" style={{ width: progressWidth(exportJob ?? scanJob) }} />
              </div>
              <div className="mt-2 text-xs text-muted">{scanJob?.progress.assetsFound || scan?.assets.length || 0} assets · {scanJob?.progress.pagesScanned || 0} pages</div>
            </div>
          )}

          {error && <div role="alert" className="mt-4 flex gap-3 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-100"><AlertTriangle size={18} /> {error}</div>}
          {scan?.warnings.map((warning) => <div key={warning} className="mt-3 rounded-2xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{warning}</div>)}

          {!scan && (
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[['Discover', 'Images, video, fonts, audio, CSS, scripts, and documents.'], ['Review', 'Thumbnails, metadata, search, and category selection.'], ['Export', 'Organized folders or the site’s own paths, plus a manifest.']].map(([title, copy]) => (
                <div key={title} className="rounded-2xl border border-line bg-panel p-5"><div className="font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></div>
              ))}
            </div>
          )}

          {scan && (
            <div className="mt-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-lime">{demo ? 'Sample library' : 'Discovered assets'}</div>
                  <h2 className="mt-2 text-2xl font-semibold">{scan.assets.length} files from {scan.title}</h2>
                  <div className="mt-1 break-all font-mono text-xs text-muted">{scan.finalUrl}</div>
                </div>
                <button data-testid="export-button" type="button" onClick={() => void exportZip()} disabled={busy !== null || !selected.length} className="inline-flex items-center gap-2 rounded-2xl bg-lime px-5 py-3 font-semibold text-ink">
                  {busy === 'export' ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowDownToLine size={18} />}
                  {demo ? 'Download sample ZIP' : `Export ${selected.length}`}
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((cat) => {
                  const ids = scan.assets.filter((asset) => asset.category === cat).map((asset) => asset.id);
                  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
                  return (
                    <div key={cat} className={`rounded-2xl border p-3 ${category === cat ? 'border-lime' : 'border-line'} bg-panel`}>
                      <div className="flex items-center justify-between">
                        <button type="button" className="text-left" onClick={() => setCategory(category === cat ? 'all' : cat)}>
                          <div className="text-[11px] uppercase tracking-wide text-muted">{cat}</div>
                          <div className="mt-1 text-2xl font-semibold">{counts?.[cat] ?? 0}</div>
                        </button>
                        <input type="checkbox" checked={all} disabled={!ids.length} onChange={() => toggleCategory(cat)} aria-label={`Select all ${cat}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <div className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3">
                  <Search size={16} className="text-muted" />
                  <input className="w-full bg-transparent py-3 text-sm outline-none" placeholder="Search filename or URL" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <select className="rounded-xl border border-line bg-panel px-3 py-3 text-sm" value={size} onChange={(event) => setSize(event.target.value)} aria-label="Size filter">
                  <option value="all">Any size</option>
                  <option value="small">Under 100 KB</option>
                  <option value="medium">100 KB – 1 MB</option>
                  <option value="large">Over 1 MB</option>
                  <option value="unknown">Unknown size</option>
                </select>
                <select className="rounded-xl border border-line bg-panel px-3 py-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status filter">
                  <option value="all">Any status</option>
                  <option value="pending">Pending</option>
                  <option value="downloaded">Downloaded</option>
                  <option value="failed">Failed</option>
                  <option value="skipped">Skipped</option>
                </select>
                <button type="button" className="rounded-xl border border-line px-3 py-3 text-sm" onClick={() => selectVisible(true)}>Select visible</button>
                <button type="button" className="rounded-xl border border-line px-3 py-3 text-sm" onClick={() => selectVisible(false)}>Clear visible</button>
                <button type="button" className="rounded-xl border border-line px-3 py-3 text-sm" onClick={() => setSelected(scan.assets.map((asset) => asset.id))}>Select all</button>
                <button type="button" className="rounded-xl border border-line px-3 py-3 text-sm" onClick={() => setSelected([])}>Clear</button>
              </div>

              <div className="mt-4">
                <Gallery assets={filtered} selected={selected} paths={paths} previewFor={previewFor} onToggle={toggle} onOpen={setActive} />
              </div>
              {failed.length > 0 && (
                <div className="mt-4 rounded-2xl border border-red-900/80 bg-red-950/20 p-4">
                  <div className="flex items-center gap-2 font-semibold text-red-100"><X size={16} /> {failed.length} failed {failed.length === 1 ? 'download' : 'downloads'}</div>
                  <ul className="mt-3 space-y-2 text-sm">
                    {failed.slice(0, 8).map((asset) => <li key={asset.id} className="break-all text-red-100/90">{asset.savedFilename}: {asset.error}</li>)}
                  </ul>
                  <p className="mt-3 text-xs text-muted">The ZIP still contains the files that succeeded. Failures are recorded in manifest.json.</p>
                </div>
              )}
              {exportJob?.download && <div className="mt-4 flex items-center gap-2 text-sm text-lime"><Check size={16} /> Archive ready · {formatBytes(exportJob.download.bytes)} · link expires {new Date(exportJob.download.expiresAt).toLocaleString()}</div>}
            </div>
          )}
        </section>
      </main>
      {active && <DetailDrawer asset={active} path={active.outputPath || paths.get(active.id)} preview={previewFor(active)} onClose={() => setActive(null)} />}
    </div>
  );
}

function watch(id: string, onJob: (job: Job) => void) {
  let closed = false;
  let poll: ReturnType<typeof setInterval> | undefined;
  const apply = (job: Job) => {
    onJob(job);
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      closed = true;
      source.close();
      if (poll) clearInterval(poll);
    }
  };
  const source = new EventSource(withBase(`/api/jobs/${id}/events`));
  source.onmessage = (event) => {
    try { apply(JSON.parse(event.data) as Job); } catch { /* ignore malformed events */ }
  };
  source.onerror = () => {
    source.close();
    if (closed) return;
    poll = setInterval(() => {
      void fetch(withBase(`/api/jobs/${id}`)).then((response) => response.ok ? response.json() : null).then((job) => { if (job) apply(job as Job); });
    }, 1000);
  };
  return () => {
    closed = true;
    source.close();
    if (poll) clearInterval(poll);
  };
}

function progressWidth(job: Job | null): string {
  if (!job) return '8%';
  if (job.status === 'completed') return '100%';
  if (job.type === 'export' && job.progress.total) return `${Math.max(8, Math.round(((job.progress.completed + job.progress.failed) / job.progress.total) * 100))}%`;
  if (job.progress.phase === 'launching') return '18%';
  if (job.progress.phase === 'loading' || job.progress.phase === 'crawling') return '55%';
  if (job.progress.phase === 'extracting' || job.progress.phase === 'finalizing') return '82%';
  return '35%';
}

function matchesSize(bytes: number | undefined, size: string) {
  if (size === 'all') return true;
  if (size === 'unknown') return bytes == null;
  if (bytes == null) return false;
  if (size === 'small') return bytes < 100 * 1024;
  if (size === 'medium') return bytes >= 100 * 1024 && bytes <= 1024 * 1024;
  return bytes > 1024 * 1024;
}

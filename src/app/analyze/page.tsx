'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { apiUrl, authHeaders } from '@/lib/api/client';
import { DEMO_ANALYSIS, DEMO_PROJECT } from '@/lib/demo/blueprint';
import type { AnalysisResult, ReferenceProject } from '@/lib/analyze/model';
import type { Job } from '@/lib/types';
import { useBackend } from '@/components/backend';
import { BlueprintView } from '@/components/blueprint';

const STAGES = ['Initializing', 'Rendering desktop', 'Discovering sections', 'Mapping assets', 'Extracting design tokens', 'Inspecting interactions', 'Generating screenshots', 'Rendering tablet and mobile', 'Validating blueprint', 'Completed'];

function Analyzer() {
  const backend = useBackend();
  const params = useSearchParams();
  const requested = params.get('project') || '';
  const [url, setUrl] = useState('https://');
  const [project, setProject] = useState<ReferenceProject | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requested || backend.state !== 'connected') return;
    void fetch(apiUrl(`/api/projects/${requested}`), { headers: authHeaders() }).then(async (response) => {
      if (!response.ok) throw new Error('Project not found');
      const body = await response.json();
      setProject(body.project);
      setAnalysis(body.analysis);
      setUrl(body.project.url || 'https://');
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Project not found'));
  }, [requested, backend.state]);

  useEffect(() => {
    if (backend.state === 'demo' && !requested) {
      setProject(DEMO_PROJECT);
      setAnalysis(DEMO_ANALYSIS);
    }
  }, [backend.state, requested]);

  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return undefined;
    const timer = window.setInterval(() => {
      void fetch(apiUrl(`/api/jobs/${job.id}`), { headers: authHeaders() }).then((response) => response.json()).then((next: Job) => {
        setJob(next);
        if (next.status === 'completed' && next.projectId) {
          void fetch(apiUrl(`/api/projects/${next.projectId}`), { headers: authHeaders() }).then((response) => response.json()).then((body) => {
            setProject(body.project);
            setAnalysis(body.analysis);
          });
        }
        if (next.status === 'failed') setError(next.error || 'Analysis failed');
      });
    }, 800);
    return () => window.clearInterval(timer);
  }, [job]);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    if (backend.state !== 'connected') {
      setError('Connect the TokenForge server before analyzing a website. Demo mode does not run a scan.');
      return;
    }
    setError('');
    setAnalysis(null);
    const response = await fetch(apiUrl('/api/analyze'), {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(project ? { projectId: project.id, url } : { url }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || 'Analysis failed');
      return;
    }
    setJob({ id: body.jobId, projectId: body.projectId, status: body.status, progress: body.progress, type: 'analyze', createdAt: '', updatedAt: '' });
  }

  async function correct(patch: Record<string, unknown>) {
    if (!project || analysis?.demo) return;
    const response = await fetch(apiUrl(`/api/projects/${project.id}`), { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify(patch) });
    if (!response.ok) return;
    const body = await response.json();
    setAnalysis(body.analysis);
    setProject(body.project);
  }

  async function exportBlueprint() {
    if (!project || analysis?.demo) return;
    const response = await fetch(apiUrl(`/api/projects/${project.id}/blueprint`), { method: 'POST', headers: authHeaders(true) });
    const created = await response.json();
    if (!response.ok) {
      setError(created.error || 'Export failed');
      return;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const jobResponse = await fetch(apiUrl(`/api/jobs/${created.jobId}`), { headers: authHeaders() });
      const next = await jobResponse.json() as Job;
      if (next.status === 'completed' && next.download) {
        window.location.href = apiUrl(`/api/exports/${next.download.token}`);
        return;
      }
      if (next.status === 'failed') {
        setError(next.error || 'Export failed');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const stage = job?.progress.stage ?? 0;
  const total = job?.progress.stageTotal || 0;
  const percent = total > 0 ? Math.round((stage / total) * 100) : 0;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Website analyzer</div>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Read the page. Keep the structure.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">A completed asset scan and a completed visual analysis are separate. Analysis reuses files already found for the project and does not download them again.</p>
      <form className="mt-5 flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 sm:flex-row" onSubmit={(event) => void start(event)}>
        <input aria-label="Reference website URL" className="flex-1 rounded-2xl border border-line bg-ink px-4 py-3" value={url} onChange={(event) => setUrl(event.target.value)} />
        <button className="rounded-2xl bg-lime px-5 py-3 font-semibold text-ink" type="submit">Analyze website</button>
        {analysis && !analysis.demo && <button className="rounded-2xl border border-line px-5 py-3" type="button" onClick={() => void exportBlueprint()}>Export blueprint</button>}
      </form>
      {job && total > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3" aria-live="polite">
          <div className="flex items-center justify-between text-sm"><span>{job.progress.message}</span><span>{percent}% · {Math.round((job.progress.elapsedMs || 0) / 1000)}s</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink"><div className="h-full bg-lime" style={{ width: `${percent}%` }} /></div>
          <ol className="mt-3 grid gap-1 text-xs text-muted sm:grid-cols-2">
            {STAGES.map((label, index) => <li key={label} className={index < stage ? 'text-lime' : ''}>{index < stage ? 'Done' : index === stage ? 'Now' : 'Waiting'} · {label}</li>)}
          </ol>
          {job.status === 'running' && <button type="button" className="mt-3 rounded-lg border border-line px-3 py-1 text-xs" onClick={() => void fetch(apiUrl(`/api/jobs/${job.id}/cancel`), { method: 'POST', headers: authHeaders(true) })}>Cancel</button>}
        </div>
      )}
      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm">{error}</div>}
      {analysis?.warnings.map((warning) => <div key={warning} className="mt-3 rounded-2xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">{warning}</div>)}
      {analysis && <div className="mt-5"><BlueprintView analysis={analysis} projectId={project?.id} onCorrect={analysis.demo ? undefined : (patch) => void correct(patch)} /></div>}
      {project && <p className="mt-4 text-xs text-muted">Asset scan: {project.assetScanStatus}. Visual analysis: {project.analysisStatus}.</p>}
    </div>
  );
}

export default function AnalyzePage() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading the analyzer.</p>}><Analyzer /></Suspense>;
}

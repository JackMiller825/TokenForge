'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api/client';
import { withBase } from '@/lib/format';
import { useBackend } from '@/components/backend';
import type { ReferenceProject } from '@/lib/analyze/model';

export default function OverviewPage() {
  const backend = useBackend();
  const [projects, setProjects] = useState<ReferenceProject[]>([]);
  useEffect(() => {
    if (backend.state !== 'connected') return;
    void fetch(apiUrl('/api/projects'), { headers: authHeaders() }).then((response) => response.ok ? response.json() : { projects: [] }).then((body) => setProjects(body.projects || [])).catch(() => setProjects([]));
  }, [backend.state]);
  return (
    <div className="rise">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Reference intelligence</div>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">Turn an authorized site into a blueprint.</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Download the files, then analyze the page. TokenForge keeps the asset scan and the visual analysis on the same project. Demo data is labeled and is not a scan.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card href="/download" title="Asset Downloader" copy="Collect images, video, fonts, and code with the original filenames." />
        <Card href="/analyze" title="Website Analyzer" copy="Capture screenshots, sections, colors, type, and where each asset sits." />
        <Card href="/replace" title="Replacement Studio" copy="Upload new artwork, map it to the reference, and approve what is ready." />
        <Card href="/library" title="Project Library" copy="Open, rename, compare, or export a reference project." />
      </div>
      <section className="mt-8 rounded-3xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold">Recent projects</h2>
        {backend.state === 'demo' && <p className="mt-3 text-sm text-muted">Demo mode is on. Connect an analysis server to see saved projects. The sample blueprint is not a live analysis.</p>}
        {backend.state === 'unavailable' && <p className="mt-3 text-sm text-amber-100">The analysis server did not respond. Check the backend URL in the status menu.</p>}
        {backend.state === 'connecting' && <p className="mt-3 text-sm text-muted">Checking the analysis server.</p>}
        <ul className="mt-4 divide-y divide-line">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <div className="font-semibold">{project.name}</div>
                <div className="text-xs text-muted">{project.url}</div>
              </div>
              <div className="text-xs text-muted">Assets {project.assetScanStatus} · Analysis {project.analysisStatus}</div>
              <Link className="rounded-lg border border-line px-3 py-2 text-sm" href={withBase(`/analyze?project=${project.id}`)}>Open</Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ href, title, copy }: { href: string; title: string; copy: string }) {
  return <Link href={withBase(href)} className="rounded-3xl border border-line bg-panel p-5"><div className="text-lg font-semibold">{title}</div><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></Link>;
}

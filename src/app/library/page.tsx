'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api/client';
import { withBase } from '@/lib/format';
import { DEMO_PROJECT } from '@/lib/demo/blueprint';
import type { ReferenceProject } from '@/lib/analyze/model';
import { useBackend } from '@/components/backend';

export default function LibraryPage() {
  const backend = useBackend();
  const [projects, setProjects] = useState<ReferenceProject[]>([]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    if (backend.state !== 'connected') return;
    void fetch(apiUrl('/api/projects'), { headers: authHeaders() }).then((response) => response.json()).then((body) => setProjects(body.projects || [])).catch(() => setError('The project library is unavailable.'));
  }
  useEffect(load, [backend.state]);

  async function rename(project: ReferenceProject) {
    const name = window.prompt('Project name', project.name);
    if (!name || name === project.name) return;
    await fetch(apiUrl(`/api/projects/${project.id}`), { method: 'PATCH', headers: authHeaders(true), body: JSON.stringify({ name }) });
    load();
  }

  async function remove(id: string) {
    await fetch(apiUrl(`/api/projects/${id}`), { method: 'DELETE', headers: authHeaders(true) });
    setPendingDelete(null);
    load();
  }

  async function rerun(project: ReferenceProject) {
    const response = await fetch(apiUrl('/api/analyze'), { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ projectId: project.id }) });
    if (!response.ok) {
      const body = await response.json();
      setError(body.error || 'Could not rerun the analysis');
      return;
    }
    window.location.href = withBase(`/analyze?project=${project.id}`);
  }

  const rows = backend.state === 'demo' ? [DEMO_PROJECT] : projects;
  return (
    <div>
      <h1 className="text-4xl font-semibold tracking-tight">Project library</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Each project keeps the asset scan and the website analysis apart. Deleting a project removes its local files from the server.</p>
      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm">{error}</div>}
      {backend.state === 'demo' && <div className="mt-4 rounded-2xl border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">Demo mode. The sample below is not a saved scan.</div>}
      <ul className="mt-6 space-y-3">
        {rows.map((project) => (
          <li key={project.id} className="rounded-3xl border border-line bg-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{project.name}{project.demo ? ' · demo' : ''}</div>
                <div className="text-xs text-muted">{project.url}</div>
                <div className="mt-2 text-xs text-muted">Assets {project.assetScanStatus} · Analysis {project.analysisStatus} · Replacements {project.replacementStatus || 'none'} · {project.versions.length} version{project.versions.length === 1 ? '' : 's'}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-lg border border-line px-3 py-2 text-sm" href={withBase(project.demo ? '/analyze' : `/analyze?project=${project.id}`)}>Open</Link>
                {!project.demo && <Link className="rounded-lg border border-line px-3 py-2 text-sm" href={withBase(`/download?project=${project.id}`)}>Assets</Link>}
                {!project.demo && <Link className="rounded-lg border border-line px-3 py-2 text-sm" href={withBase(`/replace?project=${project.id}`)}>Replace</Link>}
                {!project.demo && <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void rename(project)}>Rename</button>}
                {!project.demo && <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void rerun(project)}>Rerun analysis</button>}
                {!project.demo && pendingDelete !== project.id && <button type="button" className="rounded-lg border border-red-900 px-3 py-2 text-sm" onClick={() => setPendingDelete(project.id)}>Delete</button>}
                {pendingDelete === project.id && <button type="button" className="rounded-lg bg-red-700 px-3 py-2 text-sm" onClick={() => void remove(project.id)}>Confirm delete</button>}
              </div>
            </div>
            {project.versions.length > 1 && <p className="mt-3 text-xs text-muted">Open the project and add <span className="font-mono">?left=</span> and <span className="font-mono">?right=</span> version ids to compare two analyses.</p>}
          </li>
        ))}
        {!rows.length && <li className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm text-muted">No projects yet. Scan a site from the asset downloader or analyze a URL.</li>}
      </ul>
    </div>
  );
}

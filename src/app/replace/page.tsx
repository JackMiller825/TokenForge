'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useBackend } from '@/components/backend';
import { StudioWorkspace } from '@/components/studio';
import { withBase } from '@/lib/format';

function StudioPage() {
  const backend = useBackend();
  const params = useSearchParams();
  const projectId = params.get('project') || '';
  return (
    <div>
      {backend.state !== 'connected' && (
        <div className="mb-5 rounded-2xl border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">
          {backend.state === 'demo' ? 'Demo mode. The replacement studio does not invent mappings. Connect the TokenForge server, then open a project.' : 'The replacement studio needs the TokenForge server for uploads, image variants, and package export.'}
        </div>
      )}
      {!projectId && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Asset replacement studio</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Map new artwork onto a reference project.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Open a project from the library. Uploaded files, fitted variants, and the original scan stay in separate folders.</p>
          <Link className="mt-5 inline-block rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-ink" href={withBase('/library')}>Open the library</Link>
        </div>
      )}
      {projectId && backend.state === 'connected' && <StudioWorkspace projectId={projectId} />}
    </div>
  );
}

export default function ReplacePage() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading the studio.</p>}><StudioPage /></Suspense>;
}

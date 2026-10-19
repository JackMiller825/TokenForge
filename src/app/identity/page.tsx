'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBackend } from '@/components/backend';
import { IdentityStudio } from '@/components/identity-studio';
import { withBase } from '@/lib/format';

function IdentityPage() {
  const backend = useBackend();
  const params = useSearchParams();
  const projectId = params.get('project') || '';
  return (
    <div>
      {backend.state !== 'connected' && (
        <div className="mb-5 rounded-2xl border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">
          {backend.state === 'demo' ? 'Demo mode. Identity Studio does not invent a token, a contract, or official links. Connect the TokenForge server, then open a project.' : 'Identity Studio needs the TokenForge server to save, validate, and export a profile.'}
        </div>
      )}
      {!projectId && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Identity studio</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Give a reference project a new token identity.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Open a project from the library. The reference name, blueprint, and approved artwork stay where they are. The new identity is stored beside them.</p>
          <Link className="mt-5 inline-block rounded-lg bg-lime px-4 py-2 text-sm font-semibold text-ink" href={withBase('/library')}>Open the library</Link>
        </div>
      )}
      {projectId && backend.state === 'connected' && <IdentityStudio projectId={projectId} />}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<p className="text-sm text-muted">Loading Identity Studio.</p>}><IdentityPage /></Suspense>;
}

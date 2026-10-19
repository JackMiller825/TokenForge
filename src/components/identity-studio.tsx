'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiUrl, authHeaders } from '@/lib/api/client';
import { withBase } from '@/lib/format';
import type { ConsistencyCheck } from '@/lib/identity/consistency';
import type { IdentityDocument, LinkLocation, LinkType, OfficialLink, SectionCopy, Tone } from '@/lib/identity/model';
import { LINK_TYPES, NETWORKS, TONES } from '@/lib/identity/model';
import { contractLabel, PREVIEW_NOTE, tokenomicsPreview, visibleLinks } from '@/lib/identity/preview';
import type { Phase5Readiness } from '@/lib/identity/readiness';
import { sanitizeRichText } from '@/lib/identity/sanitize';
import { safeUrl } from '@/lib/identity/validate';

const TABS = [
  ['identity', 'Identity'],
  ['story', 'Story'],
  ['sections', 'Sections'],
  ['links', 'Links'],
  ['seo', 'SEO'],
  ['preview', 'Preview'],
  ['report', 'Report'],
] as const;

type Tab = (typeof TABS)[number][0];
type Viewport = 'desktop' | 'tablet' | 'mobile';

interface AssetOption {
  id: string;
  uploadId: string | null;
  filename: string;
  width?: number;
  height?: number;
}

interface IdentityPayload {
  identity: IdentityDocument;
  report: ConsistencyCheck[];
  readiness: Phase5Readiness;
  approvedAssets: AssetOption[];
  design: { colors: { value: string }[]; fonts: { family: string }[] } | null;
  revision?: IdentityDocument | null;
}

export function IdentityStudio({ projectId }: { projectId: string }) {
  const [doc, setDoc] = useState<IdentityDocument | null>(null);
  const [report, setReport] = useState<ConsistencyCheck[]>([]);
  const [readiness, setReadiness] = useState<Phase5Readiness | null>(null);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [design, setDesign] = useState<IdentityPayload['design']>(null);
  const [tab, setTab] = useState<Tab>('identity');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [sectionId, setSectionId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Loading the identity profile.');
  const [compare, setCompare] = useState<{ before: IdentityDocument; after: IdentityDocument } | null>(null);
  const docRef = useRef<IdentityDocument | null>(null);
  const skip = useRef(true);
  const requestSeq = useRef(0);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => { docRef.current = doc; }, [doc]);

  useEffect(() => {
    let cancelled = false;
    void fetch(apiUrl(`/api/projects/${projectId}/identity`), { headers: authHeaders() })
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return;
        if (!ok) {
          setError(body.error || 'The identity profile could not be opened.');
          setNotice('');
          return;
        }
        applyPayload(body as IdentityPayload, true);
        setNotice('Saved on this project.');
      })
      .catch(() => {
        if (!cancelled) setError('The identity profile could not be opened.');
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const fingerprint = doc ? JSON.stringify({ ...doc, updatedAt: '', revisions: [] }) : '';
  useEffect(() => {
    if (!docRef.current) return;
    if (skip.current) {
      skip.current = false;
      return;
    }
    const timer = window.setTimeout(() => { void send('save', { document: docRef.current }); }, 800);
    return () => window.clearTimeout(timer);
  }, [fingerprint]);

  function applyPayload(body: IdentityPayload, replaceDocument: boolean) {
    if (replaceDocument) {
      skip.current = true;
      setDoc(body.identity);
    } else if (body.identity) {
      setDoc((current) => current ? { ...current, updatedAt: body.identity.updatedAt, revisions: body.identity.revisions } : body.identity);
    }
    setReport(body.report || []);
    setReadiness(body.readiness);
    setAssets(body.approvedAssets || []);
    setDesign(body.design);
    if (!sectionId && body.identity.sections[0]) setSectionId(body.identity.sections[0].id);
  }

  async function send(action: string, extra: Record<string, unknown> = {}, replaceDocument = action !== 'save') {
    const seq = ++requestSeq.current;
    const response = await fetch(apiUrl(`/api/projects/${projectId}/identity`), {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ action, ...extra }),
    });
    const body = await response.json();
    if (seq !== requestSeq.current) return null;
    if (!response.ok) {
      setError(body.error || 'The identity update failed.');
      setNotice('');
      return null;
    }
    setError('');
    applyPayload(body as IdentityPayload, replaceDocument);
    setNotice(action === 'save' ? 'Autosaved.' : 'Saved.');
    return body as IdentityPayload;
  }

  function update(recipe: (current: IdentityDocument) => IdentityDocument) {
    setDoc((current) => current ? recipe(current) : current);
  }

  function onTabKey(event: React.KeyboardEvent) {
    const ids = TABS.map(([id]) => id);
    const index = ids.indexOf(tab);
    const next = event.key === 'ArrowRight' ? ids[(index + 1) % ids.length] : event.key === 'ArrowLeft' ? ids[(index - 1 + ids.length) % ids.length] : null;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabs.current[next]?.focus();
  }

  async function commitThen(action: string, extra: Record<string, unknown> = {}) {
    const saved = await send('save', { document: docRef.current }, false);
    if (!saved) return null;
    return send(action, extra, true);
  }

  async function saveRevision() {
    if (!doc) return;
    await send('revision', { document: doc, label: 'Manual save' }, true);
  }

  async function exportZip() {
    setNotice('Packing the identity profile.');
    const response = await fetch(apiUrl(`/api/projects/${projectId}/identity/export`), { method: 'POST', headers: authHeaders(true) });
    const created = await response.json();
    if (!response.ok) {
      setError(created.error || 'Export failed.');
      return;
    }
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const jobResponse = await fetch(apiUrl(`/api/jobs/${created.jobId}`), { headers: authHeaders() });
      const job = await jobResponse.json();
      if (job.status === 'completed' && job.download) {
        window.location.href = apiUrl(`/api/exports/${job.download.token}`);
        setNotice('Identity package ready.');
        return;
      }
      if (job.status === 'failed') {
        setError(job.error || 'Export failed.');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  function downloadJson() {
    if (!doc) return;
    const copy = { ...doc, revisions: [] };
    const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'tokenforge-identity.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const text = await file.text();
    if (text.length > 500_000) {
      setError('That identity file is larger than the import limit.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('That file is not valid JSON.');
      return;
    }
    await send('import', { document: parsed }, true);
  }

  if (!doc) {
    return error
      ? <div role="alert" className="rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm">{error}</div>
      : <p className="text-sm text-muted">{notice}</p>;
  }

  const sections = [...doc.sections].sort((left, right) => left.order - right.order);
  const selected = sections.find((section) => section.id === sectionId) || sections[0];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-lime">Identity studio</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{doc.token.name || 'New token identity'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Reference: {doc.referenceTitle || 'Untitled'} · {doc.referenceUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-lime px-3 py-2 text-sm font-semibold text-ink" onClick={() => void saveRevision()}>Save revision</button>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void commitThen('suggest')}>Fill empty fields</button>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={downloadJson}>Download JSON</button>
          <label className="rounded-lg border border-line px-3 py-2 text-sm">Import JSON<input className="sr-only" type="file" accept="application/json" aria-label="Import identity JSON" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); }} /></label>
          <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void send('save', { document: docRef.current }, false).then(() => exportZip())}>Export package</button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">{notice}{readiness ? ` · ${readiness.ready ? 'Phase 5 has no hard blockers.' : `${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'}.`}` : ''}</p>
      {error && <div role="alert" className="mt-3 rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm">{error}</div>}
      <div className="mt-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Identity studio" onKeyDown={onTabKey}>
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} ref={(node) => { tabs.current[id] = node; }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${tab === id ? 'bg-lime text-ink' : 'border border-line text-muted'}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      <div className="mt-4" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'identity' && <IdentityFields doc={doc} assets={assets} update={update} reset={(field) => void commitThen('reset-field', { field })} />}
        {tab === 'story' && <StoryFields doc={doc} update={update} onTone={(tone) => update((current) => ({ ...current, narrative: { ...current.narrative, tone } }))} />}
        {tab === 'sections' && selected && (
          <SectionFields
            sections={sections}
            selected={selected}
            assets={assets}
            onSelect={setSectionId}
            update={update}
            duplicate={() => {
              if (!selected.sourceSectionId) {
                setError('Only a blueprint section can be duplicated. This block has no source section.');
                return;
              }
              setError('');
              update((current) => ({
                ...current,
                sections: [...current.sections, { ...selected, id: `copy-${crypto.randomUUID()}`, order: current.sections.length, duplicated: true, displayName: `${selected.displayName} copy` }],
              }));
            }}
            restore={() => void commitThen('restore-section', { sectionId: selected.id })}
            move={(delta) => update((current) => moveSection(current, selected.id, delta))}
          />
        )}
        {tab === 'sections' && !selected && <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm text-muted">This project has no blueprint sections yet. Run the website analyzer, then return here. Existing copy stays put.</p>}
        {tab === 'links' && <LinkFields doc={doc} update={update} />}
        {tab === 'seo' && <SeoFields doc={doc} assets={assets} update={update} />}
        {tab === 'preview' && <Preview doc={doc} design={design} assets={assets} viewport={viewport} onViewport={setViewport} />}
        {tab === 'report' && <Report doc={doc} report={report} readiness={readiness} onException={(word) => void commitThen('exception', { word })} onRestore={(revisionId) => void send('restore', { revisionId }, true)} onCompare={async (revisionId) => {
          const response = await fetch(apiUrl(`/api/projects/${projectId}/identity?revision=${revisionId}`), { headers: authHeaders() });
          const body = await response.json();
          if (body.revision && doc) setCompare({ before: body.revision as IdentityDocument, after: doc });
        }} compare={compare} />}
      </div>
      <p className="mt-6 text-sm text-muted"><Link className="text-lime" href={withBase(`/replace?project=${projectId}`)}>Approved artwork lives in Replacement Studio.</Link> Identity edits do not change those files.</p>
    </div>
  );
}

function IdentityFields({ doc, assets, update, reset }: { doc: IdentityDocument; assets: AssetOption[]; update: (recipe: (current: IdentityDocument) => IdentityDocument) => void; reset: (field: string) => void }) {
  const token = doc.token;
  const set = (key: keyof typeof token, value: string) => update((current) => ({ ...current, token: { ...current.token, [key]: value } }));
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Basic identity</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Token name" value={token.name} onChange={(value) => set('name', value)} />
          <Field label="Ticker" value={token.ticker} onChange={(value) => set('ticker', value)} hint="Capitalization is kept as typed." />
          <Field label="Brand tagline" value={token.tagline} onChange={(value) => set('tagline', value)} />
          <Select label="Blockchain" value={token.networkId} onChange={(value) => set('networkId', value)} options={[...NETWORKS.map((network) => [network.id, network.label] as [string, string]), ['custom', 'Custom network']]} />
          {token.networkId === 'custom' && <Field label="Custom network" value={token.customNetwork} onChange={(value) => set('customNetwork', value)} />}
          <Select label="Contract status" value={token.contractStatus} onChange={(value) => set('contractStatus', value)} options={[['coming-soon', 'Coming soon'], ['configured', 'Configured'], ['unverified', 'Unverified']]} />
          <Select label="Launch status" value={token.launchStatus} onChange={(value) => set('launchStatus', value)} options={[['coming-soon', 'Coming soon'], ['planned', 'Planned'], ['live', 'Live']]} />
          <Field label="Contract address" value={token.contractAddress} onChange={(value) => set('contractAddress', value)} hint={contractLabel(doc)} />
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Short description" value={token.shortDescription} onChange={(value) => set('shortDescription', value)} multiline />
          <Field label="Long description" value={token.longDescription} onChange={(value) => set('longDescription', value)} multiline />
        </div>
        <button type="button" className="mt-3 text-sm text-lime" onClick={() => reset('token.name')}>Reset token name</button>
      </section>
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Token details</h2>
        <p className="mt-2 text-sm text-muted">These values are website copy. Evidence says whether you verified them. Planned copy is never shown as a chain fact.</p>
        <div className="mt-3 grid gap-3">
          <Field label="Total supply" value={doc.tokenomics.totalSupply} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, totalSupply: value } }))} />
          <Field label="Buy tax" value={doc.tokenomics.buyTax} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, buyTax: value } }))} />
          <Field label="Sell tax" value={doc.tokenomics.sellTax} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, sellTax: value } }))} />
          <Field label="Liquidity label" value={doc.tokenomics.liquidityLabel} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, liquidityLabel: value } }))} />
          <Select label="Liquidity evidence" value={doc.tokenomics.liquidityEvidence} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, liquidityEvidence: value as IdentityDocument['tokenomics']['liquidityEvidence'] } }))} options={EVIDENCE} />
          <Field label="Ownership label" value={doc.tokenomics.ownershipLabel} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, ownershipLabel: value } }))} />
          <Select label="Ownership evidence" value={doc.tokenomics.ownershipEvidence} onChange={(value) => update((current) => ({ ...current, tokenomics: { ...current.tokenomics, ownershipEvidence: value as IdentityDocument['tokenomics']['ownershipEvidence'] } }))} options={EVIDENCE} />
        </div>
        <label className="mt-4 block text-sm"><span className="text-muted">Favicon from approved artwork</span>
          <select className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2" aria-label="Favicon" value={token.faviconAssetId} onChange={(event) => set('faviconAssetId', event.target.value)}>
            <option value="">None selected</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}
          </select>
        </label>
      </section>
    </div>
  );
}

function StoryFields({ doc, update, onTone }: { doc: IdentityDocument; update: (recipe: (current: IdentityDocument) => IdentityDocument) => void; onTone: (tone: Tone) => void }) {
  const set = (key: keyof IdentityDocument['narrative'], value: string) => update((current) => ({ ...current, narrative: { ...current.narrative, [key]: value } }));
  return (
    <section className="rounded-3xl border border-line bg-panel p-4">
      <h2 className="text-lg font-semibold">Narrative</h2>
      <p className="mt-2 text-sm text-muted">A tone preset changes only the tone marker. It does not replace writing you already entered. Suggestions are templates, and they fill empty fields only.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {TONES.map((tone) => <button key={tone.id} type="button" className={`rounded-lg px-3 py-2 text-sm ${doc.narrative.tone === tone.id ? 'bg-lime text-ink' : 'border border-line'}`} onClick={() => onTone(tone.id)}>{tone.label}</button>)}
      </div>
      <div className="mt-4 grid gap-3">
        {([
          ['origin', 'Origin story'],
          ['mascot', 'Mascot introduction'],
          ['personality', 'Character personality'],
          ['project', 'Project narrative'],
          ['moments', 'Funny moments'],
          ['community', 'Community identity'],
          ['voice', 'Brand voice'],
          ['slogans', 'Memorable slogans'],
          ['callsToAction', 'Calls to action'],
          ['faqs', 'FAQs'],
          ['roadmap', 'Roadmap'],
        ] as const).map(([key, label]) => <Field key={key} label={label} value={doc.narrative[key]} onChange={(value) => set(key, value)} multiline />)}
      </div>
    </section>
  );
}

function SectionFields({ sections, selected, assets, onSelect, update, duplicate, restore, move }: {
  sections: SectionCopy[];
  selected: SectionCopy;
  assets: AssetOption[];
  onSelect: (id: string) => void;
  update: (recipe: (current: IdentityDocument) => IdentityDocument) => void;
  duplicate: () => void;
  restore: () => void;
  move: (delta: number) => void;
}) {
  const patch = (recipe: (section: SectionCopy) => SectionCopy) => update((current) => ({
    ...current,
    sections: current.sections.map((section) => section.id === selected.id ? recipe(section) : section),
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ul className="rounded-3xl border border-line bg-panel p-2">
        {sections.map((section) => (
          <li key={section.id}>
            <button type="button" className={`w-full rounded-xl px-3 py-2 text-left text-sm ${section.id === selected.id ? 'bg-lime text-ink' : ''}`} onClick={() => onSelect(section.id)}>{section.hidden ? 'Hidden · ' : ''}{section.displayName || section.id}</button>
          </li>
        ))}
      </ul>
      <section className="rounded-3xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{selected.displayName || selected.id}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-line px-3 py-1 text-sm" onClick={() => move(-1)}>Move up</button>
            <button type="button" className="rounded-lg border border-line px-3 py-1 text-sm" onClick={() => move(1)}>Move down</button>
            <button type="button" className="rounded-lg border border-line px-3 py-1 text-sm" onClick={duplicate}>Duplicate</button>
            <button type="button" className="rounded-lg border border-line px-3 py-1 text-sm" onClick={restore}>Restore metadata</button>
          </div>
        </div>
        <p className="mt-2 font-mono text-xs text-muted">Section ID {selected.id}{selected.duplicated ? ' · duplicated block' : ''}</p>
        {!selected.sourceSectionId && <p className="mt-2 text-sm text-amber-100">This block is not tied to a blueprint section, so it cannot be duplicated or restored from the analyzer.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Display name" value={selected.displayName} onChange={(value) => patch((section) => ({ ...section, displayName: value }))} />
          <Field label="Section purpose" value={selected.purpose} onChange={(value) => patch((section) => ({ ...section, purpose: value }))} />
          <Field label="Headline" value={selected.headline} onChange={(value) => patch((section) => ({ ...section, headline: value }))} />
          <Field label="Subheadline" value={selected.subheadline} onChange={(value) => patch((section) => ({ ...section, subheadline: value }))} />
          <Field label="Primary button" value={selected.primaryButton} onChange={(value) => patch((section) => ({ ...section, primaryButton: value }))} />
          <Field label="Secondary button" value={selected.secondaryButton} onChange={(value) => patch((section) => ({ ...section, secondaryButton: value }))} />
          <Field label="Button destination" value={selected.buttonDestination} onChange={(value) => patch((section) => ({ ...section, buttonDestination: value }))} />
        </div>
        <div className="mt-3 grid gap-3">
          <Field label="Description" value={selected.description} onChange={(value) => patch((section) => ({ ...section, description: value }))} multiline />
          <Field label="Rich text" value={selected.body} onChange={(value) => patch((section) => ({ ...section, body: value }))} multiline />
          <Field label="Mobile copy" value={selected.mobileCopy} onChange={(value) => patch((section) => ({ ...section, mobileCopy: value }))} multiline />
          <Field label="Notes" value={selected.notes} onChange={(value) => patch((section) => ({ ...section, notes: value }))} multiline />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.hidden} onChange={(event) => patch((section) => ({ ...section, hidden: event.target.checked }))} /> Hide this section</label>
        <label className="mt-3 block text-sm"><span className="text-muted">Background asset</span>
          <select className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2" aria-label="Background asset" value={selected.backgroundAssetId} onChange={(event) => patch((section) => ({ ...section, backgroundAssetId: event.target.value }))}>
            <option value="">None</option>
            {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}</option>)}
          </select>
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm text-muted">Approved Phase 3 assets</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {assets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.assetIds.includes(asset.id)} onChange={(event) => patch((section) => ({ ...section, assetIds: event.target.checked ? [...section.assetIds, asset.id] : section.assetIds.filter((id) => id !== asset.id) }))} />
                {asset.filename}
              </label>
            ))}
            {!assets.length && <p className="text-sm text-muted">No approved replacements yet.</p>}
          </div>
        </fieldset>
      </section>
    </div>
  );
}

function LinkFields({ doc, update }: { doc: IdentityDocument; update: (recipe: (current: IdentityDocument) => IdentityDocument) => void }) {
  function add() {
    const link: OfficialLink = { id: crypto.randomUUID(), type: 'website', label: 'Website', url: '', enabled: true, status: 'coming-soon', locations: ['footer'], icon: '' };
    update((current) => ({ ...current, links: [...current.links, link] }));
  }
  return (
    <section className="rounded-3xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Official links</h2>
        <button type="button" className="rounded-lg bg-lime px-3 py-2 text-sm font-semibold text-ink" onClick={add}>Add link</button>
      </div>
      <p className="mt-2 text-sm text-muted">Coming Soon is a valid state. TokenForge does not invent a Telegram, X, or contract URL. Enabled links open in a new tab with a noreferrer relationship.</p>
      <div className="mt-4 space-y-4">
        {doc.links.map((link) => (
          <div key={link.id} className="rounded-2xl border border-line p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Type" value={link.type} onChange={(value) => patchLink(update, link.id, { type: value as LinkType })} options={LINK_TYPES.map((item) => [item.id, item.label])} />
              <Field label="Label" id={`link-label-${link.id}`} value={link.label} onChange={(value) => patchLink(update, link.id, { label: value })} />
              <Select label="Verification" value={link.status} onChange={(value) => patchLink(update, link.id, { status: value as OfficialLink['status'] })} options={[['coming-soon', 'Coming soon'], ['configured', 'Configured']]} />
              <Field label="URL" id={`link-url-${link.id}`} value={link.url} onChange={(value) => patchLink(update, link.id, { url: value })} hint={link.url && !safeUrl(link.url) ? 'Use an http or https URL.' : ''} />
              <Field label="Icon name" id={`link-icon-${link.id}`} value={link.icon} onChange={(value) => patchLink(update, link.id, { icon: value })} hint="Optional. Remote icon files are not loaded." />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {(['header', 'hero', 'body', 'footer'] as LinkLocation[]).map((location) => (
                <label key={location} className="flex items-center gap-2"><input type="checkbox" checked={link.locations.includes(location)} onChange={(event) => patchLink(update, link.id, { locations: event.target.checked ? [...link.locations, location] : link.locations.filter((item) => item !== location) })} /> {location}</label>
              ))}
              <label className="flex items-center gap-2"><input type="checkbox" checked={link.enabled} onChange={(event) => patchLink(update, link.id, { enabled: event.target.checked })} /> Enabled</label>
              <button type="button" className="text-red-200" onClick={() => update((current) => ({ ...current, links: current.links.filter((item) => item.id !== link.id) }))}>Remove</button>
            </div>
          </div>
        ))}
        {!doc.links.length && <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-sm text-muted">No official links yet. Add one, or leave them empty. Coming Soon is recorded only when you add the row.</p>}
      </div>
    </section>
  );
}

function SeoFields({ doc, assets, update }: { doc: IdentityDocument; assets: AssetOption[]; update: (recipe: (current: IdentityDocument) => IdentityDocument) => void }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Search and sharing</h2>
        <div className="mt-3 grid gap-3">
          <Field label="Website title" value={doc.token.websiteTitle} onChange={(value) => update((current) => ({ ...current, token: { ...current.token, websiteTitle: value } }))} />
          <Field label="Meta description" value={doc.token.seoDescription} onChange={(value) => update((current) => ({ ...current, token: { ...current.token, seoDescription: value } }))} hint={`${doc.token.seoDescription.length}/180`} />
          <Field label="Open Graph title" value={doc.seo.ogTitle} onChange={(value) => update((current) => ({ ...current, seo: { ...current.seo, ogTitle: value } }))} />
          <Field label="Open Graph description" value={doc.seo.ogDescription} onChange={(value) => update((current) => ({ ...current, seo: { ...current.seo, ogDescription: value } }))} hint={`${doc.seo.ogDescription.length}/200`} />
          <Field label="Canonical URL" value={doc.seo.canonicalUrl} onChange={(value) => update((current) => ({ ...current, seo: { ...current.seo, canonicalUrl: value } }))} hint="Leave blank until the public site exists." />
          <Select label="Robots" value={doc.seo.robots} onChange={(value) => update((current) => ({ ...current, seo: { ...current.seo, robots: value as IdentityDocument['seo']['robots'] } }))} options={[['index,follow', 'Index and follow'], ['noindex,nofollow', 'No index']]} />
          <Select label="Structured data" value={doc.seo.structuredData} onChange={(value) => update((current) => ({ ...current, seo: { ...current.seo, structuredData: value as IdentityDocument['seo']['structuredData'] } }))} options={[['none', 'None'], ['website', 'Website, only when a website URL is configured']]} />
          <label className="block text-sm"><span className="text-muted">Social sharing image</span>
            <select className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2" aria-label="Social sharing image" value={doc.seo.shareImageAssetId} onChange={(event) => update((current) => ({ ...current, seo: { ...current.seo, shareImageAssetId: event.target.value } }))}>
              <option value="">None selected</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.filename}{asset.width ? ` · ${asset.width}×${asset.height}` : ''}</option>)}
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Sharing card</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line">
          <div className="grid h-36 place-items-center bg-ink text-sm text-muted">{assets.find((asset) => asset.id === doc.seo.shareImageAssetId)?.filename || 'No sharing image selected'}</div>
          <div className="p-3">
            <div className="text-xs uppercase text-muted">{doc.seo.canonicalUrl || 'Canonical URL not set'}</div>
            <div className="mt-1 font-semibold">{doc.seo.ogTitle || doc.token.websiteTitle || doc.token.name || 'Untitled'}</div>
            <p className="mt-1 text-sm text-muted">{doc.seo.ogDescription || doc.token.seoDescription || 'No description yet.'}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Preview({ doc, design, assets, viewport, onViewport }: { doc: IdentityDocument; design: IdentityPayload['design']; assets: AssetOption[]; viewport: Viewport; onViewport: (viewport: Viewport) => void }) {
  const width = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : 1100;
  const header = visibleLinks(doc, 'header');
  const footer = visibleLinks(doc, 'footer');
  const hero = visibleLinks(doc, 'hero');
  const artwork = assets.find((asset) => asset.id === doc.sections.find((section) => section.backgroundAssetId)?.backgroundAssetId) || assets[0];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((item) => <button key={item} type="button" className={`rounded-lg px-3 py-2 text-sm capitalize ${viewport === item ? 'bg-lime text-ink' : 'border border-line'}`} onClick={() => onViewport(item)}>{item}</button>)}
      </div>
      <p className="mt-3 text-sm text-amber-100">{PREVIEW_NOTE}</p>
      <div className="mt-4 overflow-x-auto">
        <article className="rounded-3xl border border-line p-4" style={{ width, maxWidth: '100%', background: doc.appearance.background, color: doc.appearance.text, fontFamily: doc.appearance.fontFamily }}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
            <strong style={{ color: doc.appearance.accent }}>{doc.token.name || 'Token name'} {doc.token.ticker ? `$${doc.token.ticker}` : ''}</strong>
            <nav className="flex flex-wrap gap-2 text-sm">{header.map((link) => <PreviewLink key={link.id} link={link} />)}</nav>
          </header>
          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <p className="text-xs uppercase tracking-[0.16em]" style={{ color: doc.appearance.accent }}>Token identity card</p>
              <h2 className="mt-2 text-2xl font-semibold">{doc.token.websiteTitle || doc.token.name || 'Untitled site'}</h2>
              <p className="mt-2 text-sm">{doc.token.tagline || 'Tagline not written yet.'}</p>
              <p className="mt-3 text-sm">{contractLabel(doc)}</p>
              {doc.token.contractStatus !== 'coming-soon' && doc.token.contractAddress && <p className="mt-1 break-all font-mono text-xs">{doc.token.contractAddress}</p>}
              <ul className="mt-3 space-y-1 text-sm">{tokenomicsPreview(doc).map((line) => <li key={line}>{line}</li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-2">{hero.map((link) => <PreviewLink key={link.id} link={link} />)}</div>
            </div>
            <div className="rounded-2xl border border-white/10 p-3 text-sm">
              <div className="text-xs uppercase text-muted">Artwork</div>
              <p className="mt-2">{artwork?.filename || 'No approved artwork selected.'}</p>
              {design?.colors?.length ? <p className="mt-2 text-xs">Reference colors stay available. Accent {doc.appearance.accent} is the current override.</p> : <p className="mt-2 text-xs">No observed palette is stored on this project.</p>}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {doc.sections.filter((section) => !section.hidden).map((section) => (
              <section key={section.id} className="rounded-2xl border border-white/10 p-3">
                <h3 className="font-semibold">{viewport === 'mobile' && section.mobileCopy ? section.mobileCopy : section.headline || section.displayName}</h3>
                {section.subheadline && <p className="text-sm">{section.subheadline}</p>}
                {section.body && <div className="mt-2 text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichText(section.body) }} />}
                <div className="mt-2 flex gap-2 text-sm">
                  {section.primaryButton && <span className="rounded-lg px-2 py-1" style={{ background: doc.appearance.accent, color: doc.appearance.background }}>{section.primaryButton}</span>}
                  {section.secondaryButton && <span className="rounded-lg border border-white/20 px-2 py-1">{section.secondaryButton}</span>}
                </div>
              </section>
            ))}
          </div>
          <footer className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-sm">{footer.map((link) => <PreviewLink key={link.id} link={link} />)}</footer>
        </article>
      </div>
    </div>
  );
}

function PreviewLink({ link }: { link: { id: string; label: string; href: string; comingSoon: boolean } }) {
  if (link.comingSoon || !link.href) return <span>{link.label} · Coming soon</span>;
  return <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>;
}

function Report({ doc, report, readiness, onException, onRestore, onCompare, compare }: {
  doc: IdentityDocument;
  report: ConsistencyCheck[];
  readiness: Phase5Readiness | null;
  onException: (word: string) => void;
  onRestore: (revisionId: string) => void;
  onCompare: (revisionId: string) => void;
  compare: { before: IdentityDocument; after: IdentityDocument } | null;
}) {
  const passed = report.filter((item) => item.severity === 'pass');
  const warnings = report.filter((item) => item.severity === 'warn');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Brand consistency</h2>
        <h3 className="mt-3 text-sm font-semibold text-lime">Passed</h3>
        <ul className="mt-2 space-y-2 text-sm">{passed.map((item) => <li key={`${item.code}-${item.message}`}>{item.message}</li>)}{!passed.length && <li className="text-muted">No passing checks yet.</li>}</ul>
        <h3 className="mt-4 text-sm font-semibold text-amber-100">Warnings and unresolved branding</h3>
        <ul className="mt-2 space-y-2 text-sm">{warnings.map((item) => <li key={`${item.code}-${item.message}`}>{item.message}</li>)}{!warnings.length && <li className="text-muted">No branding warnings.</li>}</ul>
        <label className="mt-4 block text-sm"><span className="text-muted">Approve an exception phrase</span>
          <input className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2" aria-label="Exception phrase" onKeyDown={(event) => { if (event.key === 'Enter') { onException((event.target as HTMLInputElement).value); (event.target as HTMLInputElement).value = ''; } }} />
        </label>
        {!!doc.exceptions.length && <p className="mt-2 text-xs text-muted">Exceptions: {doc.exceptions.join(', ')}</p>}
      </section>
      <section className="rounded-3xl border border-line bg-panel p-4">
        <h2 className="text-lg font-semibold">Phase 5 readiness</h2>
        <p className="mt-2 text-sm">{readiness?.ready ? 'No hard blockers. Warnings can stay while you keep editing.' : 'Hard blockers have to be cleared before a generator can run.'}</p>
        <ul className="mt-3 space-y-2 text-sm">{readiness?.blockers.map((item) => <li key={item.message}>Blocker · {item.message}</li>)}</ul>
        <ul className="mt-3 space-y-2 text-sm text-muted">{readiness?.warnings.slice(0, 8).map((item) => <li key={item.message}>Warning · {item.message}</li>)}</ul>
        <h3 className="mt-4 text-sm font-semibold">Revisions</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {doc.revisions.map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{revision.label} · {revision.at.slice(0, 16).replace('T', ' ')}</span>
              <span className="flex gap-2">
                <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => onCompare(revision.id)}>Compare</button>
                <button type="button" className="rounded-lg border border-line px-2 py-1" onClick={() => onRestore(revision.id)}>Restore</button>
              </span>
            </li>
          ))}
          {!doc.revisions.length && <li className="text-muted">No manual revisions yet. Autosave does not create one on each keystroke.</li>}
        </ul>
        {compare && <div className="mt-3 rounded-2xl border border-line p-3 text-sm"><p>Name: {compare.before.token.name || 'Empty'} → {compare.after.token.name || 'Empty'}</p><p>Ticker: {compare.before.token.ticker || 'Empty'} → {compare.after.token.ticker || 'Empty'}</p></div>}
      </section>
    </div>
  );
}

function Field({ label, value, onChange, multiline = false, hint = '', id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; hint?: string; id?: string }) {
  const className = 'mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm';
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="text-muted">{label}</span>
      {multiline ? <textarea id={id} className={`${className} min-h-24`} value={value} onChange={(event) => onChange(event.target.value)} /> : <input id={id} className={className} value={value} onChange={(event) => onChange(event.target.value)} />}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  const id = `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="text-muted">{label}</span>
      <select id={id} className="mt-1 w-full rounded-xl border border-line bg-ink px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
      </select>
    </label>
  );
}

const EVIDENCE: [string, string][] = [
  ['planned', 'Planned'],
  ['pending-verification', 'Pending verification'],
  ['verified', 'Verified'],
  ['not-applicable', 'Not applicable'],
];

function patchLink(update: (recipe: (current: IdentityDocument) => IdentityDocument) => void, id: string, patch: Partial<OfficialLink>) {
  update((current) => ({ ...current, links: current.links.map((link) => link.id === id ? { ...link, ...patch } : link) }));
}

function moveSection(doc: IdentityDocument, id: string, delta: number): IdentityDocument {
  const ordered = [...doc.sections].sort((left, right) => left.order - right.order);
  const index = ordered.findIndex((section) => section.id === id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= ordered.length) return doc;
  const copy = ordered.slice();
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item!);
  return { ...doc, sections: copy.map((section, order) => ({ ...section, order })) };
}

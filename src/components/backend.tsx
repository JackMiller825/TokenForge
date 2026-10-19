'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { apiBase, apiUrl, setApiBase, STATIC_EXPORT } from '@/lib/api/client';

export type BackendState = 'connecting' | 'connected' | 'unavailable' | 'demo';

interface BackendValue {
  state: BackendState;
  base: string;
  authRequired: boolean;
  setBase: (value: string) => void;
  useDemo: () => void;
  retry: () => void;
}

const BackendContext = createContext<BackendValue>({
  state: 'connecting',
  base: '',
  authRequired: false,
  setBase: () => undefined,
  useDemo: () => undefined,
  retry: () => undefined,
});

export function useBackend() {
  return useContext(BackendContext);
}

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BackendState>('connecting');
  const [base, setBaseState] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const saved = apiBase();
    const target = saved || (!STATIC_EXPORT ? '' : 'http://127.0.0.1:3000');
    setBaseState(target);
    setState('connecting');
    const health = target ? `${target}/api/health` : apiUrl('/api/health');
    const timer = window.setTimeout(() => {
      if (!cancelled) setState(STATIC_EXPORT ? 'demo' : 'unavailable');
    }, 4000);
    void fetch(health)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('unavailable')))
      .then((body) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        if (!saved && STATIC_EXPORT) setApiBase(target);
        setAuthRequired(Boolean(body.authRequired));
        setState('connected');
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timer);
        setState(saved ? 'unavailable' : 'demo');
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [attempt]);

  const value: BackendValue = {
    state,
    base,
    authRequired,
    setBase: (next) => {
      setApiBase(next);
      setBaseState(next);
      setAttempt((count) => count + 1);
    },
    useDemo: () => setState('demo'),
    retry: () => setAttempt((count) => count + 1),
  };
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

const COPY: Record<BackendState, string> = {
  connecting: 'Connecting',
  connected: 'Connected',
  unavailable: 'Unavailable',
  demo: 'Demo mode',
};

export function BackendStatus() {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(backend.base);
  useEffect(() => setDraft(backend.base), [backend.base]);
  return (
    <div className="relative">
      <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog">
        <span className={`h-2 w-2 rounded-full ${backend.state === 'connected' ? 'bg-lime' : backend.state === 'connecting' ? 'bg-amber-300 pulse' : backend.state === 'demo' ? 'bg-sky-300' : 'bg-red-400'}`} />
        {COPY[backend.state]}
      </button>
      {open && (
        <form className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-line bg-panel p-4 shadow-xl" onSubmit={(event) => { event.preventDefault(); backend.setBase(draft); setOpen(false); }}>
          <div className="text-sm font-semibold">Analysis server</div>
          <p className="mt-2 text-xs leading-5 text-muted">GitHub Pages cannot run Chromium. Point this dashboard at a TokenForge server. The access token stays in this browser and is never built into the page.</p>
          <label className="mt-3 block text-xs uppercase tracking-wide text-muted">Backend URL
            <input className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="http://127.0.0.1:3000" />
          </label>
          <div className="mt-3 flex gap-2">
            <button className="rounded-lg bg-lime px-3 py-2 text-sm font-semibold text-ink" type="submit">Connect</button>
            <button className="rounded-lg border border-line px-3 py-2 text-sm" type="button" onClick={() => { backend.useDemo(); setOpen(false); }}>Use demo</button>
          </div>
        </form>
      )}
    </div>
  );
}

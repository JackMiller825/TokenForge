import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir, LIMITS } from '../config';
import { scanSite } from '../browser/scanner';
import { CancelledError } from '../browser/cancel';
import { exportAssets } from '../download/pipeline';
import { analyzeSite } from '../analyze/engine';
import { writeBlueprint } from '../analyze/export';
import { HttpError } from '../http/errors';
import { projects } from '../projects/store';
import { emptyProgress, type Job, type ScanInput, type ScanResult } from '../types';

interface Memory {
  jobs: Map<string, Job>;
  cookies: Map<string, { name: string; value: string; domain: string; path: string }[]>;
  aborts: Map<string, AbortController>;
  loaded: boolean;
  chain: Promise<unknown>;
  writes: Map<string, number>;
}

const memory: Memory = ((globalThis as typeof globalThis & { __tokenforge?: Memory }).__tokenforge ??= {
  jobs: new Map(),
  cookies: new Map(),
  aborts: new Map(),
  loaded: false,
  chain: Promise.resolve(),
  writes: new Map(),
});

function root() {
  return join(process.cwd(), dataDir());
}

function jobPath(id: string) {
  return join(root(), 'jobs', `${id}.json`);
}

function ensure() {
  mkdirSync(join(root(), 'jobs'), { recursive: true });
  mkdirSync(join(root(), 'exports'), { recursive: true });
  mkdirSync(join(root(), 'tmp'), { recursive: true });
}

function persist(job: Job, force = false) {
  const now = Date.now();
  const previous = memory.writes.get(job.id) || 0;
  if (!force && now - previous < 400) return;
  memory.writes.set(job.id, now);
  ensure();
  const file = jobPath(job.id);
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(job));
  rmSync(file, { force: true });
  try {
    writeFileSync(file, JSON.stringify(job));
    rmSync(tmp, { force: true });
  } catch {
    writeFileSync(file, JSON.stringify(job));
  }
}

function load() {
  if (memory.loaded) return;
  memory.loaded = true;
  try {
    ensure();
    for (const name of readdirSync(join(root(), 'jobs'))) {
      if (!name.endsWith('.json')) continue;
      const job = JSON.parse(readFileSync(join(root(), 'jobs', name), 'utf8')) as Job;
      if (job.status === 'running' || job.status === 'queued') {
        job.status = 'failed';
        job.error = 'Interrupted by a process restart';
        job.updatedAt = new Date().toISOString();
      }
      memory.jobs.set(job.id, job);
    }
    const cutoff = Date.now() - LIMITS.exportTtlMs;
    for (const name of readdirSync(join(root(), 'exports'))) {
      const file = join(root(), 'exports', name);
      if (statSync(file).mtimeMs < cutoff) rmSync(file, { force: true });
    }
  } catch {
    // The data directory is created on the first job.
  }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = memory.chain.then(task, task);
  memory.chain = run.then(() => undefined, () => undefined);
  return run;
}

function setStatus(job: Job, status: Job['status']) {
  job.status = status;
}

function touch(job: Job) {
  job.updatedAt = new Date().toISOString();
}

export function getJob(id: string): Job | null {
  load();
  return memory.jobs.get(id) ?? null;
}

export function cookiesFor(id: string) {
  load();
  return memory.cookies.get(id) ?? [];
}

export function startScan(input: ScanInput): Job {
  load();
  const now = new Date().toISOString();
  const { testAllowHosts, ...safeInput } = input;
  const job: Job = {
    id: randomUUID(),
    type: 'scan',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    progress: emptyProgress('Queued'),
    scanInput: safeInput,
  };
  memory.jobs.set(job.id, job);
  persist(job, true);
  void enqueue(async () => {
    const starting = job.status;
    if (starting === 'cancelled') return;
    const controller = new AbortController();
    memory.aborts.set(job.id, controller);
    setStatus(job, 'running');
    job.progress = { ...job.progress, phase: 'launching', message: 'Starting the browser' };
    touch(job);
    persist(job, true);
    try {
      const output = await scanSite({ ...input, testAllowHosts }, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (job.status === 'cancelled') return;
          job.progress = progress;
          touch(job);
          persist(job);
        },
      });
      memory.cookies.set(job.id, output.cookies);
      job.result = output.result;
      if (job.status !== 'cancelled') {
        rememberScan(job, output.result);
        setStatus(job, 'completed');
      }
      job.progress = { ...job.progress, phase: 'done', message: job.status === 'cancelled' ? 'Cancelled' : `Discovered ${output.result.assets.length} assets`, assetsFound: output.result.assets.length };
    } catch (error) {
      if (error instanceof CancelledError || controller.signal.aborted || job.status === 'cancelled') {
        setStatus(job, 'cancelled');
        job.error = 'Cancelled';
      } else {
        setStatus(job, 'failed');
        job.error = error instanceof Error ? error.message : 'Scan failed';
      }
    } finally {
      memory.aborts.delete(job.id);
      touch(job);
      persist(job, true);
    }
  });
  return job;
}

export function startExport(scanJobId: string, selectedIds: string[], structure: 'organized' | 'source'): Job {
  load();
  const scan = memory.jobs.get(scanJobId);
  if (!scan?.result) throw new HttpError(404, 'Scan results are no longer available. Run the scan again.');
  const selected = new Set(selectedIds);
  const assets = scan.result.assets.filter((asset) => selected.has(asset.id)).slice(0, LIMITS.maxExport);
  if (!assets.length) throw new HttpError(400, 'Select at least one asset from this scan');
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    type: 'export',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    progress: { ...emptyProgress('Queued'), total: assets.length },
  };
  memory.jobs.set(job.id, job);
  persist(job, true);
  void enqueue(async () => {
    const starting = job.status;
    if (starting === 'cancelled') return;
    const controller = new AbortController();
    memory.aborts.set(job.id, controller);
    setStatus(job, 'running');
    touch(job);
    persist(job, true);
    const workDir = join(root(), 'tmp', job.id);
    const zipPath = join(root(), 'exports', `${job.id}.zip`);
    try {
      const outcome = await exportAssets({
        scan: scan.result!,
        assets,
        structure,
        zipPath,
        workDir,
        signal: controller.signal,
        cookies: memory.cookies.get(scanJobId) ?? [],
        onProgress: (progress) => {
          job.progress = progress;
          touch(job);
          persist(job);
        },
      });
      const expiresAt = new Date(Date.now() + LIMITS.exportTtlMs).toISOString();
      job.manifest = outcome.manifest;
      job.download = { token: signExport(job.id, Date.parse(expiresAt)), expiresAt, bytes: outcome.bytes, filename: 'tokenforge-assets.zip' };
      setStatus(job, controller.signal.aborted ? 'cancelled' : 'completed');
      const updates = new Map(outcome.manifest.assets.map((asset) => [asset.id, asset]));
      scan.result!.assets = scan.result!.assets.map((asset) => updates.get(asset.id) ?? asset);
      persist(scan, true);
    } catch (error) {
      setStatus(job, error instanceof CancelledError || controller.signal.aborted ? 'cancelled' : 'failed');
      job.error = error instanceof Error ? error.message : 'Export failed';
      rmSync(workDir, { recursive: true, force: true });
    } finally {
      memory.aborts.delete(job.id);
      touch(job);
      persist(job, true);
    }
  });
  return job;
}

export function cancelJob(id: string): Job | null {
  load();
  const job = memory.jobs.get(id);
  if (!job) return null;
  if (job.status === 'queued' || job.status === 'running') {
    job.status = 'cancelled';
    job.error = 'Cancelled';
    job.progress = { ...job.progress, message: 'Cancelled' };
    memory.aborts.get(id)?.abort();
    touch(job);
    persist(job, true);
  }
  return job;
}

function secret(): string {
  ensure();
  if (process.env.TOKENFORGE_SECRET) return process.env.TOKENFORGE_SECRET;
  const file = join(root(), 'secret');
  try {
    return readFileSync(file, 'utf8');
  } catch {
    const value = randomBytes(32).toString('hex');
    writeFileSync(file, value, { mode: 0o600 });
    return value;
  }
}

export function signExport(id: string, expiresAt: number): string {
  const body = Buffer.from(JSON.stringify({ id, exp: expiresAt })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyExport(token: string): { id: string } {
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new HttpError(403, 'Invalid download link');
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new HttpError(403, 'Invalid download link');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { id?: string; exp?: number };
  if (!payload.id || !/^[a-zA-Z0-9-]{10,80}$/.test(payload.id) || !payload.exp || payload.exp < Date.now()) {
    throw new HttpError(403, 'Download link expired');
  }
  return { id: payload.id };
}

export function exportFile(id: string): string {
  return join(root(), 'exports', `${id}.zip`);
}

function rememberScan(job: Job, result: ScanResult) {
  try {
    const store = projects();
    const project = job.projectId ? store.get(job.projectId) : null;
    const saved = project ?? store.create({ name: result.title || safeHost(result.pageUrl), url: result.pageUrl, title: result.title });
    store.saveScan(saved.id, result, job.id);
    job.projectId = saved.id;
  } catch (error) {
    job.progress = { ...job.progress, message: error instanceof Error ? error.message : 'Project save failed' };
  }
}

function safeHost(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return 'Reference project';
  }
}

export function startAnalyze(input: { url?: string; projectId?: string; testAllowHosts?: string[] }): Job {
  load();
  const store = projects();
  const existing = input.projectId ? store.get(input.projectId) : null;
  if (input.projectId && !existing) throw new HttpError(404, 'Unknown project');
  const url = existing?.url || input.url;
  if (!url) throw new HttpError(400, 'A project or URL is required');
  const project = existing ?? store.create({ name: safeHost(url), url });
  store.update(project.id, { analysisStatus: 'running', analysisJobId: undefined });
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    type: 'analyze',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    projectId: project.id,
    progress: { ...emptyProgress('Queued'), stage: 0, stageTotal: 9 },
  };
  memory.jobs.set(job.id, job);
  persist(job, true);
  store.update(project.id, { analysisJobId: job.id, analysisStatus: 'running' });
  void enqueue(async () => {
    const starting = job.status;
    if (starting === 'cancelled') return;
    const controller = new AbortController();
    memory.aborts.set(job.id, controller);
    setStatus(job, 'running');
    touch(job);
    persist(job, true);
    try {
      const scan = store.readScan(project.id);
      const analysis = await analyzeSite({
        url,
        projectId: project.id,
        projectDir: store.dir(project.id),
        manifest: scan?.assets,
        signal: controller.signal,
        testAllowHosts: input.testAllowHosts,
        onProgress: (progress) => {
          if (job.status === 'cancelled') return;
          job.progress = progress;
          touch(job);
          persist(job);
        },
      });
      if (job.status === 'cancelled') return;
      store.saveAnalysis(project.id, analysis);
      setStatus(job, 'completed');
      job.progress = { ...job.progress, phase: 'done', message: `Blueprint ready · ${analysis.sections.length} sections`, stage: 9, stageTotal: 9, assetsFound: analysis.assetMap.length };
    } catch (error) {
      const cancelled = error instanceof CancelledError || controller.signal.aborted || job.status === 'cancelled';
      setStatus(job, cancelled ? 'cancelled' : 'failed');
      job.error = cancelled ? 'Cancelled' : error instanceof Error ? error.message : 'Analysis failed';
      store.update(project.id, { analysisStatus: cancelled ? 'none' : 'failed', warnings: [job.error] });
    } finally {
      memory.aborts.delete(job.id);
      touch(job);
      persist(job, true);
    }
  });
  return job;
}

export function startBlueprint(projectId: string): Job {
  load();
  const store = projects();
  const project = store.get(projectId);
  if (!project) throw new HttpError(404, 'Unknown project');
  const analysis = store.readAnalysis(project.id);
  if (!analysis) throw new HttpError(404, 'Analyze the project before exporting a blueprint');
  const now = new Date().toISOString();
  const job: Job = {
    id: randomUUID(),
    type: 'blueprint',
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    projectId: project.id,
    progress: { ...emptyProgress('Preparing the blueprint'), total: 1 },
  };
  memory.jobs.set(job.id, job);
  persist(job, true);
  void enqueue(async () => {
    if (job.status === 'cancelled') return;
    setStatus(job, 'running');
    const zipPath = join(root(), 'exports', `${job.id}.zip`);
    try {
      const outcome = await writeBlueprint(zipPath, store.dir(project.id), analysis);
      if (outcome.errors.length) throw new Error(outcome.errors.join(' '));
      const expiresAt = new Date(Date.now() + LIMITS.exportTtlMs).toISOString();
      job.download = { token: signExport(job.id, Date.parse(expiresAt)), expiresAt, bytes: outcome.bytes, filename: 'reference-blueprint.zip' };
      setStatus(job, 'completed');
      job.progress = { ...job.progress, phase: 'done', message: 'Blueprint ready', completed: 1, total: 1, bytes: outcome.bytes };
    } catch (error) {
      setStatus(job, 'failed');
      job.error = error instanceof Error ? error.message : 'Blueprint export failed';
      rmSync(zipPath, { force: true });
    } finally {
      touch(job);
      persist(job, true);
    }
  });
  return job;
}

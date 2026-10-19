import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from '../config';
import type { ScanResult } from '../types';
import type { AnalysisResult, ReferenceProject } from '../analyze/model';

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertProjectId(id: string): string {
  if (!ID.test(id)) throw new Error('Unknown project');
  return id;
}

interface StoreDriver {
  list(): ReferenceProject[];
  get(id: string): ReferenceProject | null;
  insert(project: ReferenceProject): void;
  replace(project: ReferenceProject): void;
  remove(id: string): void;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, value: unknown) {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

function jsonDriver(root: string): StoreDriver {
  const file = join(root, 'projects', 'index.json');
  const read = () => readJson<ReferenceProject[]>(file) ?? [];
  const write = (projects: ReferenceProject[]) => writeJson(file, projects);
  return {
    list: () => read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    get: (id) => read().find((project) => project.id === id) ?? null,
    insert: (project) => write([project, ...read()]),
    replace: (project) => write(read().map((item) => item.id === project.id ? project : item)),
    remove: (id) => write(read().filter((project) => project.id !== id)),
  };
}

function sqliteDriver(root: string): StoreDriver | null {
  try {
    // Node 22.5+ exposes this built-in. Large files stay on disk, not in rows.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const require = createRequire(import.meta.url);
    const loaded = require('node:sqlite') as { DatabaseSync: new (path: string) => SqliteDatabase };
    mkdirSync(join(root, 'projects'), { recursive: true });
    const db = new loaded.DatabaseSync(join(root, 'projects', 'projects.sqlite'));
    db.exec(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      document TEXT NOT NULL
    )`);
    return {
      list: () => (db.prepare('SELECT document FROM projects').all() as { document: string }[])
        .map((row) => JSON.parse(row.document) as ReferenceProject)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      get: (id) => {
        const row = db.prepare('SELECT document FROM projects WHERE id = ?').get(id) as { document: string } | undefined;
        return row ? JSON.parse(row.document) as ReferenceProject : null;
      },
      insert: (project) => {
        db.prepare('INSERT INTO projects (id, document) VALUES (?, ?)').run(project.id, JSON.stringify(project));
      },
      replace: (project) => {
        db.prepare('UPDATE projects SET document = ? WHERE id = ?').run(JSON.stringify(project), project.id);
      },
      remove: (id) => {
        db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      },
    };
  } catch {
    return null;
  }
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): { all(): unknown; get(...args: unknown[]): unknown; run(...args: unknown[]): unknown };
}

export class ProjectStore {
  readonly driverName: 'sqlite' | 'json';
  private readonly driver: StoreDriver;

  constructor(private readonly root: string, prefer: 'auto' | 'json' | 'sqlite' = 'auto') {
    mkdirSync(join(root, 'projects'), { recursive: true });
    const sqlite = prefer === 'json' ? null : sqliteDriver(root);
    if (sqlite && prefer !== 'json') {
      this.driver = sqlite;
      this.driverName = 'sqlite';
    } else {
      this.driver = jsonDriver(root);
      this.driverName = 'json';
    }
  }

  list(): ReferenceProject[] {
    return this.driver.list();
  }

  get(id: string): ReferenceProject | null {
    return this.driver.get(assertProjectId(id));
  }

  create(input: { name: string; url: string; title?: string }): ReferenceProject {
    const now = new Date().toISOString();
    const project: ReferenceProject = {
      id: randomUUID(),
      name: input.name.trim().slice(0, 120) || 'Untitled reference',
      url: input.url,
      title: input.title || '',
      createdAt: now,
      updatedAt: now,
      assetScanStatus: 'none',
      analysisStatus: 'none',
      versions: [],
      warnings: [],
      demo: false,
      replacementStatus: 'none',
    };
    this.driver.insert(project);
    mkdirSync(this.dir(project.id), { recursive: true });
    return project;
  }

  update(id: string, patch: Partial<ReferenceProject>): ReferenceProject {
    const current = this.require(id);
    const next = { ...current, ...patch, id: current.id, demo: current.demo, updatedAt: new Date().toISOString() };
    this.driver.replace(next);
    return next;
  }

  remove(id: string) {
    const project = this.require(id);
    this.driver.remove(project.id);
    rmSync(this.dir(project.id), { recursive: true, force: true });
  }

  saveScan(id: string, scan: ScanResult, jobId?: string): ReferenceProject {
    const project = this.require(id);
    writeJson(join(this.dir(id), 'scan.json'), scan);
    return this.update(id, {
      title: scan.title || project.title,
      url: scan.pageUrl || project.url,
      assetScanStatus: 'completed',
      scanJobId: jobId || project.scanJobId,
      warnings: scan.warnings,
    });
  }

  readScan(id: string): ScanResult | null {
    this.require(id);
    return readJson<ScanResult>(join(this.dir(id), 'scan.json'));
  }

  saveAnalysis(id: string, analysis: AnalysisResult, label?: string): ReferenceProject {
    const project = this.require(id);
    const versionId = randomUUID();
    const createdAt = new Date().toISOString();
    writeJson(join(this.dir(id), 'versions', `${versionId}.json`), analysis);
    writeJson(join(this.dir(id), 'analysis.json'), analysis);
    return this.update(id, {
      title: analysis.title || project.title,
      analysisStatus: 'completed',
      currentVersionId: versionId,
      versions: [...project.versions, { id: versionId, createdAt, label: label || createdAt }],
      warnings: analysis.warnings,
    });
  }

  replaceCurrent(id: string, analysis: AnalysisResult): ReferenceProject {
    const project = this.require(id);
    writeJson(join(this.dir(id), 'analysis.json'), analysis);
    if (project.currentVersionId) writeJson(join(this.dir(id), 'versions', `${assertProjectId(project.currentVersionId)}.json`), analysis);
    return this.update(id, { warnings: analysis.warnings });
  }

  readAnalysis(id: string, versionId?: string): AnalysisResult | null {
    this.require(id);
    const file = versionId ? join(this.dir(id), 'versions', `${assertProjectId(versionId)}.json`) : join(this.dir(id), 'analysis.json');
    return readJson<AnalysisResult>(file);
  }

  dir(id: string): string {
    return join(this.root, 'projects', assertProjectId(id));
  }

  file(id: string, relative: string): string | null {
    const shot = /^screenshots\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;
    const studio = /^studio\/(uploads|derived)\/[0-9a-f-]+\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|mp4|webm|mov|woff2?|ttf|otf)$/i;
    if (!shot.test(relative) && !studio.test(relative)) return null;
    const full = join(this.dir(id), relative);
    return existsSync(full) ? full : null;
  }

  private require(id: string): ReferenceProject {
    const project = this.get(id);
    if (!project) throw new Error('Unknown project');
    return project;
  }
}

let singleton: ProjectStore | null = null;

export function projects(): ProjectStore {
  if (!singleton) singleton = new ProjectStore(join(process.cwd(), dataDir()));
  return singleton;
}

export function resetProjectsForTests(root: string): ProjectStore {
  singleton = new ProjectStore(root, 'json');
  return singleton;
}

export function versionFiles(root: string, id: string): string[] {
  const dir = join(root, 'projects', id, 'versions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith('.json'));
}

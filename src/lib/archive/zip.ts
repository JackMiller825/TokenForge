import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import archiver from 'archiver';
import { readmeFor } from './manifest';
import type { ManifestFile } from '../types';

export async function writeZip(zipPath: string, files: Array<{ path: string; file: string }>, manifest: ManifestFile): Promise<number> {
  await mkdir(dirname(zipPath), { recursive: true });
  const archive = archiver('zip', { zlib: { level: 6 } });
  const output = createWriteStream(zipPath);
  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
  });
  archive.pipe(output);
  for (const file of files) archive.file(file.file, { name: file.path.replace(/\\/g, '/') });
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
  archive.append(readmeFor(manifest), { name: 'README.md' });
  await archive.finalize();
  await finished;
  return (await stat(zipPath)).size;
}

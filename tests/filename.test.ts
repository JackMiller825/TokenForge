import { describe, expect, it } from 'vitest';
import { allocateName, basenameFromUrl, sanitizeSegment } from '../src/lib/security/filename';
import { plannedFilename, planPaths } from '../src/lib/archive/names';

describe('filenames', () => {
  it('preserves capitalization, unicode, and hashed names', () => {
    expect(basenameFromUrl('https://cdn.example.com/static/Hero.PNG')).toBe('Hero.PNG');
    expect(basenameFromUrl('https://cdn.example.com/%E7%94%BB%E5%83%8F.png')).toBe('画像.png');
    expect(basenameFromUrl('https://cdn.example.com/static/a1b2c3d4e5.png')).toBe('a1b2c3d4e5.png');
    const hashed = plannedFilename('https://cdn.example.com/static/a1b2c3d4e5.png', 'image/png', 1);
    expect(hashed.filenameInferred).toBe(false);
    expect(hashed.savedFilename).toBe('a1b2c3d4e5.png');
  });

  it('removes traversal, controls, and reserved Windows names', () => {
    expect(sanitizeSegment('../secret.png')).not.toContain('..');
    expect(basenameFromUrl('http://example.com/foo%2Fbar.png')).toBe('foo_bar.png');
    expect(basenameFromUrl('http://example.com/a%00b.png')).toBe('ab.png');
    expect(basenameFromUrl('http://example.com/CON.png')).toBe('_CON.png');
    expect(sanitizeSegment('..\\..\\windows')).not.toMatch(/\.\./);
  });

  it('adds a stable suffix when names collide without regard to case', () => {
    const used = new Set<string>();
    expect(allocateName('Hero.png', used)).toBe('Hero.png');
    expect(allocateName('hero.PNG', used)).toBe('hero__2.PNG');
    expect(allocateName('hero.min.png', new Set(['hero.min.png']))).toBe('hero.min__2.png');
  });

  it('marks extensionless names as inferred and does not invent a semantic name', () => {
    const named = plannedFilename('https://cdn.example.com/media/12345', 'image/png', 4);
    expect(named.originalFilename).toBe('12345');
    expect(named.savedFilename).toBe('12345.png');
    expect(named.filenameInferred).toBe(true);
    const missing = plannedFilename('https://cdn.example.com/media/', 'image/png', 4);
    expect(missing.originalFilename).toBeNull();
    expect(missing.savedFilename).toBe('asset-4.png');
    expect(missing.filenameInferred).toBe(true);
  });

  it('plans organized and source paths without leaving the archive root', () => {
    const assets = [
      { id: 'b', category: 'images', savedFilename: 'logo.png', resolvedUrl: 'https://cdn.example.com/a/logo.png' },
      { id: 'a', category: 'images', savedFilename: 'Logo.PNG', resolvedUrl: 'https://cdn.example.com/b/Logo.PNG' },
    ];
    const organized = planPaths(assets, ['a', 'b'], 'organized');
    expect(organized.get('a')).toBe('images/Logo.PNG');
    expect(organized.get('b')).toBe('images/logo__2.png');
    const source = planPaths([assets[1]], ['a'], 'source');
    expect(source.get('a')).toBe('cdn.example.com/b/Logo.PNG');
    expect([...organized.values()].every((path) => !path.split('/').includes('..'))).toBe(true);
  });
});

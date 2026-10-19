import { afterEach, describe, expect, it } from 'vitest';
import { linkHref, withBase } from '../src/lib/format';

const previous = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = previous;
});

describe('GitHub Pages paths', () => {
  it('lets Next.js add the base path once', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/TokenForge';
    expect(linkHref('/identity')).toBe('/identity');
    expect(linkHref('/TokenForge/identity')).toBe('/identity');
    expect(linkHref('/TokenForge')).toBe('/');
    expect(withBase('/identity')).toBe('/TokenForge/identity');
    expect(withBase('/TokenForge/identity')).toBe('/TokenForge/identity');
    expect(withBase(withBase('/help'))).toBe('/TokenForge/help');
  });
});

import { resolveUrl } from './urls';

const PATTERNS = [
  /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
  /@import\s+(['"])([^'"]+)\1/gi,
  /@import\s+url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
];

export function extractCssRefs(css: string, baseUrl: string): string[] {
  const found = new Set<string>();
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of css.matchAll(pattern)) {
      const raw = match[2];
      if (!raw || /^(data|blob):/i.test(raw)) continue;
      const resolved = resolveUrl(raw, baseUrl);
      if (resolved) found.add(resolved);
    }
  }
  return [...found];
}

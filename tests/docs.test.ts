import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const help = readFileSync('src/app/help/page.tsx', 'utf8');

describe('documentation coverage', () => {
  it('explains Phase 2, deployment, and the blueprint package', () => {
    for (const text of [readme, help]) {
      expect(text).toMatch(/Phase 2|website analyzer/i);
      expect(text).toMatch(/TOKENFORGE_ALLOWED_ORIGINS/);
      expect(text).toMatch(/NEXT_PUBLIC_API_BASE/);
      expect(text).toMatch(/reference-blueprint\.zip|design-system\.json/);
      expect(text).toMatch(/Phase 3|Replacement Studio|replacement studio/);
      expect(text).toMatch(/tokenforge-replacement-package\.zip/);
      expect(text).toMatch(/Phase 4|Identity Studio/);
      expect(text).toMatch(/tokenforge-identity-package\.zip/);
      expect(text).toMatch(/Coming Soon|coming-soon/);
      expect(text).toMatch(/brand consistency|Brand consistency/i);
      expect(text).toMatch(/Not saved/);
      expect(text).toMatch(/not added by hand|do not add it again/);
      expect(text).toMatch(/Demo mode/);
      expect(text).toMatch(/Known limitations/);
    }
  });
});

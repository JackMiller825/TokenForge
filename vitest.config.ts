import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
    server: { deps: { external: ['playwright', 'playwright-core'] } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});

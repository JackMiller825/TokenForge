import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeSite, browserCount } from '../src/lib/analyze/engine';
import { PNG, startServer } from './helpers';

describe('local website analysis', () => {
  it('captures sections, screenshots, tokens, and asset positions', async () => {
    const site = await startServer((req, res) => {
      const path = req.url?.split('?')[0];
      if (path === '/logo.png' || path === '/bg.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html><html><head><title>Fixture Token</title>
        <style>
          :root { --brand: #2563eb; }
          body { margin: 0; font-family: Georgia, serif; background: #111; color: white; }
          header { position: sticky; top: 0; display: flex; gap: 16px; background: #222; padding: 16px; }
          .hero { display: flex; min-height: 320px; padding: 32px; background: #1e293b; }
          .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 32px; }
          .bg { background-image: url(/bg.png); height: 180px; }
          footer { padding: 24px; }
          button.safe { transition: background-color .2s ease; background: #333; }
          @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
        </style></head><body>
        <header><nav><a href="#features">Features</a></nav></header>
        <section class="hero"><h1>Fixture Token</h1><img src="/logo.png" width="64" height="64" alt="logo"></section>
        <section id="features" class="grid"><h2>Features</h2><div>One</div><div>Two</div><div>Three</div></section>
        <section class="bg"></section>
        <section class="token"><h2>Token</h2><p>Supply</p><img src="/logo.png" alt="again"></section>
        <video poster="/logo.png" src="/clip.mp4"></video>
        <details><summary>How it works</summary><p>Answer</p></details>
        <canvas id="fx" width="10" height="10"></canvas>
        <div hidden>secret</div>
        <button class="safe" type="button">Show more</button>
        <img src="http://169.254.169.254/latest/meta-data" alt="">
        <footer><h2>Footer</h2></footer>
      </body></html>`);
    });
    const dir = mkdtempSync(join(tmpdir(), 'tf-analyze-'));
    try {
      const result = await analyzeSite({
        url: `${site.url}/`,
        projectId: '22222222-2222-4222-8222-222222222222',
        projectDir: dir,
        testAllowHosts: ['127.0.0.1'],
        manifest: [{ id: 'logo1', url: `${site.url}/logo.png`, sourceUrl: `${site.url}/logo.png`, resolvedUrl: `${site.url}/logo.png` }],
        settleMs: 200,
      });
      expect(result.demo).toBe(false);
      expect(result.sections.some((section) => section.role === 'header' || section.role === 'sticky')).toBe(true);
      expect(result.sections.some((section) => section.role === 'footer' || section.role === 'token')).toBe(true);
      expect(result.screenshots.some((shot) => shot.viewport === 'desktop' && shot.kind === 'full-page')).toBe(true);
      expect(result.screenshots.some((shot) => shot.viewport === 'tablet' && shot.kind === 'full-page')).toBe(true);
      expect(result.screenshots.some((shot) => shot.viewport === 'mobile' && shot.kind === 'full-page')).toBe(true);
      expect(result.assetMap.some((asset) => asset.manifestAssetId === 'logo1')).toBe(true);
      expect(result.assetMap.some((asset) => asset.sourceUrl.includes('169.254.169.254'))).toBe(false);
      expect(result.designSystem.declaredVariables.some((item) => item.name === '--brand') || result.designSystem.breakpoints.length > 0).toBe(true);
      expect(result.responsive).toHaveLength(3);
      expect(result.interactions.some((item) => item.kind === 'accordion' || item.kind === 'canvas' || item.kind === 'sticky') || result.animations.some((item) => item.kind === 'canvas')).toBe(true);
    } finally {
      await site.close();
      expect(browserCount()).toBe(0);
    }
  }, 120_000);
});

import { describe, expect, it } from 'vitest';
import { scanSite } from '../src/lib/browser/scanner';
import { PNG, startServer } from './helpers';

const html = (external: string) => `<!doctype html>
<html><head>
  <title>Fixture Token</title>
  <link rel="icon" href="/images/favicon.ico">
  <link rel="stylesheet" href="/styles/main.css">
</head><body style="min-height:2400px">
  <img src="/images/Hero.png" alt="">
  <img class="lazy" data-src="/images/lazy.jpg" alt="">
  <img srcset="/images/small.png 480w, /images/large.png 1200w" alt="">
  <picture><source srcset="/images/picture.webp" type="image/webp"><img src="/images/picture.png" alt=""></picture>
  <video poster="/images/poster.jpg" src="/media/clip.mp4"></video>
  <img src="${external}/cdn/external.png" alt="">
  <img src="http://169.254.169.254/latest/meta-data" alt="">
  <script src="https://www.google-analytics.com/analytics.js"></script>
  <a href="/about.html">About</a>
  <button type="button" id="reveal">Show gallery</button>
  <style>.inline{background-image:url('/images/inline.png')}</style>
  <script>
    const lazy = document.querySelector('.lazy');
    window.addEventListener('scroll', () => { if (lazy && lazy.dataset.src) lazy.src = lazy.dataset.src; });
    document.getElementById('reveal').addEventListener('click', () => {
      const image = document.createElement('img');
      image.src = '/images/dynamic.png';
      document.body.appendChild(image);
    });
  </script>
</body></html>`;

describe('fixture website', () => {
  it('discovers rendered, lazy, nested, and interacted assets', async () => {
    const files = new Map<string, { body: Buffer | string; type: string }>([
      ['/images/Hero.png', { body: PNG, type: 'image/png' }],
      ['/images/lazy.jpg', { body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), type: 'image/jpeg' }],
      ['/images/small.png', { body: PNG, type: 'image/png' }],
      ['/images/large.png', { body: PNG, type: 'image/png' }],
      ['/images/picture.png', { body: PNG, type: 'image/png' }],
      ['/images/picture.webp', { body: Buffer.from('RIFF\0\0\0\0WEBP', 'ascii'), type: 'image/webp' }],
      ['/images/poster.jpg', { body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), type: 'image/jpeg' }],
      ['/images/favicon.ico', { body: Buffer.from([0, 0, 1, 0, 0, 0]), type: 'image/x-icon' }],
      ['/images/bg.png', { body: PNG, type: 'image/png' }],
      ['/images/inline.png', { body: PNG, type: 'image/png' }],
      ['/images/nested.gif', { body: Buffer.from('GIF89a', 'ascii'), type: 'image/gif' }],
      ['/images/dynamic.png', { body: PNG, type: 'image/png' }],
      ['/images/logo.png', { body: PNG, type: 'image/png' }],
      ['/assets/logo.png', { body: PNG, type: 'image/png' }],
      ['/media/clip.mp4', { body: Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom')]), type: 'video/mp4' }],
      ['/fonts/demo.woff2', { body: Buffer.from('wOF2demo'), type: 'font/woff2' }],
      ['/styles/main.css', { body: "@import '/styles/nested.css';\n.hero{background-image:url('/images/bg.png')}\n", type: 'text/css' }],
      ['/styles/nested.css', { body: "@font-face{font-family:Demo;src:url('/fonts/demo.woff2')}\n.icon{background:url('/images/nested.gif')}\n", type: 'text/css' }],
    ]);
    const external = await startServer((req, res) => {
      if (req.url === '/cdn/external.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.end(PNG);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    const site = await startServer((req, res) => {
      const path = req.url || '/';
      if (path === '/' || path === '/index.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(html(external.url));
        return;
      }
      if (path === '/about.html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<title>About</title><img src="/images/logo.png"><img src="/assets/logo.png">');
        return;
      }
      const file = files.get(path);
      if (!file) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'content-type': file.type });
      res.end(file.body);
    });
    try {
      const { result } = await scanSite({
        url: `${site.url}/`,
        mode: 'full',
        maxPages: 4,
        maxDepth: 2,
        includeTrackers: false,
        testAllowHosts: ['127.0.0.1'],
      });
      const urls = result.assets.map((asset) => asset.resolvedUrl);
      const expectUrl = (suffix: string) => expect(urls.some((url) => url.includes(suffix)), suffix).toBe(true);
      for (const suffix of ['/images/Hero.png', '/images/lazy.jpg', '/images/small.png', '/images/large.png', '/images/picture.webp', '/images/picture.png', '/images/poster.jpg', '/media/clip.mp4', '/images/favicon.ico', '/images/bg.png', '/images/inline.png', '/images/nested.gif', '/fonts/demo.woff2', '/images/dynamic.png', '/images/logo.png', '/assets/logo.png', '/styles/main.css', '/styles/nested.css', '/cdn/external.png']) {
        expectUrl(suffix);
      }
      expect(result.title).toBe('Fixture Token');
      expect(result.pages.some((page) => page.includes('/about.html'))).toBe(true);
      expect(urls.some((url) => url.includes('169.254.169.254'))).toBe(false);
      expect(urls.some((url) => url.includes('google-analytics'))).toBe(false);
      expect(result.assets.filter((asset) => asset.originalFilename === 'logo.png')).toHaveLength(2);
      const hero = result.assets.find((asset) => asset.originalFilename === 'Hero.png');
      expect(hero?.filenameInferred).toBe(false);
      expect(hero?.category).toBe('images');
    } finally {
      await site.close();
      await external.close();
    }
  }, 120_000);
});

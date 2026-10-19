import { describe, expect, it } from 'vitest';
import { AssetCollector } from '../src/lib/discover/collect';
import { extractCssRefs } from '../src/lib/discover/css';
import { extractFromHtml } from '../src/lib/discover/dom';
import { isUnsafeInteraction } from '../src/lib/discover/interact';
import { isDisallowed, parseRobots } from '../src/lib/discover/robots';
import { canonicalUrl, resolveUrl } from '../src/lib/discover/urls';
import { consumeRate } from '../src/lib/http/guard';

describe('discovery parsing', () => {
  it('resolves relative URLs, srcset, lazy images, posters, and nested CSS', () => {
    const html = `
      <link rel="stylesheet" href="/styles/main.css">
      <img src="../images/Hero.png">
      <img data-src="/images/lazy.jpg">
      <img srcset="/images/small.png 480w, /images/large.png 1200w">
      <video poster="/images/poster.jpg" src="/media/clip.mp4"></video>
      <style>.hero{background:url('/images/bg.png')}</style>
      <a href="/about.html">About</a>
    `;
    const extracted = extractFromHtml(html, 'https://example.com/pages/home.html');
    const urls = extracted.refs.map((ref) => ref.url);
    expect(urls).toContain('https://example.com/images/Hero.png');
    expect(urls).toContain('https://example.com/images/lazy.jpg');
    expect(urls).toContain('https://example.com/images/small.png');
    expect(urls).toContain('https://example.com/images/large.png');
    expect(urls).toContain('https://example.com/images/poster.jpg');
    expect(urls).toContain('https://example.com/media/clip.mp4');
    expect(urls).toContain('https://example.com/images/bg.png');
    expect(extracted.links).toContain('https://example.com/about.html');
    expect(resolveUrl('../fonts/Demo.woff2', 'https://example.com/styles/nested.css')).toBe('https://example.com/fonts/Demo.woff2');
    expect(extractCssRefs("@import '/styles/nested.css'; .a{background:url(../images/nested.gif)}", 'https://example.com/styles/main.css')).toEqual(expect.arrayContaining([
      'https://example.com/styles/nested.css',
      'https://example.com/images/nested.gif',
    ]));
  });

  it('dedupes canonical URLs, keeps every reference, and drops trackers and private targets', () => {
    const collector = new AssetCollector();
    collector.add('https://cdn.example.com/Hero.png#section', 'dom', 'https://example.com/');
    collector.add('https://CDN.example.com/Hero.png', 'network', 'https://example.com/', 'image/png', 1200);
    collector.add('https://www.google-analytics.com/analytics.js', 'dom', 'https://example.com/');
    collector.add('http://169.254.169.254/latest/meta-data', 'dom', 'https://example.com/');
    collector.add('https://cdn.example.com/app.js?b=1&a=2', 'network', 'https://example.com/', 'application/javascript');
    const assets = collector.list();
    expect(assets.filter((asset) => asset.savedFilename === 'Hero.png')).toHaveLength(1);
    expect(assets.find((asset) => asset.savedFilename === 'Hero.png')?.references).toHaveLength(2);
    expect(assets.some((asset) => asset.resolvedUrl.includes('google-analytics'))).toBe(false);
    expect(assets.some((asset) => asset.resolvedUrl.includes('169.254.169.254'))).toBe(false);
    expect(collector.trackerSkips).toBe(1);
    expect(canonicalUrl('https://CDN.example.com/a.png#x')).toBe('https://cdn.example.com/a.png');
    expect(canonicalUrl('https://cdn.example.com/app.js?b=1&a=2')).toContain('b=1&a=2');
  });

  it('reads robots rules and refuses unsafe interactions', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /private\n\nUser-agent: Bad\nDisallow: /\n');
    expect(isDisallowed('/private/file', rules)).toBe(true);
    expect(isDisallowed('/about', rules)).toBe(false);
    expect(isUnsafeInteraction('Connect wallet', 'button', false)).toBe(true);
    expect(isUnsafeInteraction('Show gallery', 'button', false)).toBe(false);
    expect(isUnsafeInteraction('Design notes', 'button', true)).toBe(true);
    expect(isUnsafeInteraction('Design notes', 'submit', false)).toBe(true);
  });

  it('rate limits a bucket', () => {
    const key = `test-${Date.now()}`;
    expect(consumeRate(key, 2, 1_000)).toBe(true);
    expect(consumeRate(key, 2, 1_000)).toBe(true);
    expect(consumeRate(key, 2, 1_000)).toBe(false);
  });
});

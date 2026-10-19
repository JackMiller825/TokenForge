import { load } from 'cheerio';
import { extractCssRefs } from './css';
import { parseSrcset, resolveUrl, type FoundRef } from './urls';

const ATTRS: Array<[string, string]> = [
  ['img[src]', 'src'],
  ['img[data-src]', 'data-src'],
  ['img[data-lazy-src]', 'data-lazy-src'],
  ['img[data-original]', 'data-original'],
  ['source[src]', 'src'],
  ['video[src]', 'src'],
  ['video[poster]', 'poster'],
  ['audio[src]', 'src'],
  ['script[src]', 'src'],
  ['object[data]', 'data'],
  ['embed[src]', 'src'],
  ['[data-bg]', 'data-bg'],
  ['[data-background]', 'data-background'],
  ['[data-poster]', 'data-poster'],
];

export function extractFromHtml(html: string, baseUrl: string): { refs: FoundRef[]; links: string[] } {
  const $ = load(html);
  const refs: FoundRef[] = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, method: FoundRef['method']) => {
    if (!raw) return;
    const url = resolveUrl(raw, baseUrl);
    if (!url) return;
    const key = `${method}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push({ url, method });
  };

  for (const [selector, attr] of ATTRS) {
    $(selector).each((_, element) => add($(element).attr(attr), 'dom'));
  }
  $('[srcset], [data-srcset]').each((_, element) => {
    for (const key of ['srcset', 'data-srcset']) {
      const value = $(element).attr(key);
      if (!value) continue;
      for (const candidate of parseSrcset(value)) add(candidate, 'srcset');
    }
  });
  $('link[href]').each((_, element) => {
    const rel = ($(element).attr('rel') || '').toLowerCase();
    const as = ($(element).attr('as') || '').toLowerCase();
    const href = $(element).attr('href');
    if (rel.includes('stylesheet')) add(href, 'css');
    else if (rel.includes('icon')) add(href, 'icon');
    else if (rel.includes('preload') && ['image', 'font', 'video', 'audio', 'style', 'script'].includes(as)) add(href, 'preload');
  });
  $('[style]').each((_, element) => {
    for (const url of extractCssRefs($(element).attr('style') || '', baseUrl)) refs.push({ url, method: 'css' });
  });
  $('style').each((_, element) => {
    for (const url of extractCssRefs($(element).html() || '', baseUrl)) refs.push({ url, method: 'css' });
  });

  const links = $('a[href]').toArray().map((element) => resolveUrl($(element).attr('href') || '', baseUrl)).filter((url): url is string => Boolean(url));
  return { refs, links };
}

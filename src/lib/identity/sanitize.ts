const ALLOWED = new Set(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'blockquote']);

export function sanitizeRichText(input: string): string {
  const withoutActive = input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
  return withoutActive.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED.has(name)) return '';
    if (name === 'br') return '<br>';
    if (name === 'a' && !match.startsWith('</')) {
      const href = /href\s*=\s*['"](https?:\/\/[^"'<>\s]+)['"]/i.exec(attrs);
      return href ? `<a href="${href[1]}" rel="noopener noreferrer" target="_blank">` : '<a>';
    }
    return match.startsWith('</') ? `</${name}>` : `<${name}>`;
  }).slice(0, 20_000);
}

export function plain(value: string, max = 4000): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
}

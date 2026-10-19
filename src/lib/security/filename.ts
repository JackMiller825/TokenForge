const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function sanitizeSegment(segment: string): string {
  let value = segment.normalize('NFC');
  value = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
  value = value.replace(/[\u202a-\u202e\u2066-\u2069]/g, '');
  value = value.replace(/\.\./g, '_');
  value = value.replace(/[<>:"|?*\\/]/g, '_');
  value = value.replace(/^\.+/, '');
  value = value.replace(/[. ]+$/g, '');
  value = value.replace(/_+/g, (match) => (match.length > 3 ? '___' : match));
  if (!value || value === '.' || value === '..') return '';
  if (RESERVED.test(value)) value = `_${value}`;
  if (value.length > 120) {
    const dot = value.lastIndexOf('.');
    if (dot > 0 && value.length - dot <= 8) {
      const ext = value.slice(dot);
      value = `${value.slice(0, Math.max(1, 120 - ext.length))}${ext}`;
    } else {
      value = value.slice(0, 120);
    }
  }
  return value;
}

export function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function basenameFromUrl(value: string): string | null {
  try {
    const pathname = new URL(value).pathname;
    if (!pathname || pathname.endsWith('/')) return null;
    const raw = pathname.split('/').filter(Boolean).pop();
    if (!raw) return null;
    const cleaned = sanitizeSegment(decodePart(raw));
    return cleaned || null;
  } catch {
    return null;
  }
}

export function extensionOfName(name: string | null | undefined): string {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  const ext = name.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

export function extensionOfUrl(value: string): string {
  return extensionOfName(basenameFromUrl(value));
}

export function allocateName(filename: string, used: Set<string>): string {
  const normalized = filename || 'asset.bin';
  const key = normalized.toLowerCase();
  if (!used.has(key)) {
    used.add(key);
    return normalized;
  }
  const dot = normalized.lastIndexOf('.');
  const base = dot > 0 ? normalized.slice(0, dot) : normalized;
  const ext = dot > 0 ? normalized.slice(dot) : '';
  let index = 2;
  let candidate = `${base}__${index}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `${base}__${index}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

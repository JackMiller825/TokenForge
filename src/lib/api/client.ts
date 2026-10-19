import { withBase, STATIC_EXPORT } from '../format';

const BASE_KEY = 'tokenforge-api-base';
const TOKEN_KEY = 'tokenforge-token';

export function apiBase(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(BASE_KEY);
    if (saved !== null) return saved.replace(/\/$/, '');
  }
  return (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
}

export function setApiBase(value: string) {
  localStorage.setItem(BASE_KEY, value.trim().replace(/\/$/, ''));
}

export function apiUrl(path: string): string {
  const base = apiBase();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (base) return `${base}${normalized}`;
  return withBase(normalized);
}

export function authHeaders(json = false): HeadersInit {
  const token = typeof window === 'undefined' ? '' : sessionStorage.getItem(TOKEN_KEY) || '';
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function saveToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export { STATIC_EXPORT };

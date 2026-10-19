import { describe, expect, it } from 'vitest';
import { assertPublicUrl, isBlockedIp } from '../src/lib/security/network';
import { parseScanInput } from '../src/lib/jobs/input';

describe('public URL policy', () => {
  it('blocks loopback, private, link-local, metadata, and obfuscated hosts', async () => {
    const blocked = [
      'http://127.0.0.1/',
      'http://localhost/',
      'http://2130706433/',
      'http://0177.0.0.1/',
      'http://0x7f.0.0.1/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://169.254.169.254/latest/meta-data',
      'http://10.0.0.5/',
      'http://192.168.1.20/',
      'http://172.16.4.2/',
      'http://metadata.google.internal/',
      'http://intranet/admin',
      'file:///etc/passwd',
      'ftp://example.com/a.png',
      'http://user:pass@example.com/',
      'http://example.com:8080/a.png',
    ];
    for (const value of blocked) {
      await expect(assertPublicUrl(value, {}, async () => ['8.8.8.8'])).rejects.toThrow();
    }
  });

  it('allows a public address and rejects a host that also resolves privately', async () => {
    await expect(assertPublicUrl('https://cdn.example.com/a.png', {}, async () => ['8.8.8.8'])).resolves.toBeInstanceOf(URL);
    await expect(assertPublicUrl('https://cdn.example.com/a.png', {}, async () => ['8.8.8.8', '127.0.0.1'])).rejects.toThrow(/Private/);
    await expect(assertPublicUrl('http://[::ffff:8.8.8.8]/file.png')).resolves.toBeInstanceOf(URL);
    expect(isBlockedIp('8.8.8.8')).toBe(false);
    expect(isBlockedIp('::ffff:7f00:1')).toBe(true);
  });

  it('does not accept test-only hosts from an API payload', () => {
    const input = parseScanInput({ url: 'https://example.com/path', mode: 'deep', maxPages: 4, maxDepth: 2, includeTrackers: false, testAllowHosts: ['127.0.0.1'] });
    expect(input.testAllowHosts).toBeUndefined();
    expect(input.mode).toBe('deep');
    expect(input.maxPages).toBe(4);
    expect(parseScanInput({ url: 'https://example.com/', mode: 'quick', maxPages: 9 }).maxPages).toBe(1);
    expect(() => parseScanInput({ url: 'not a url' })).toThrow(/valid/);
  });
});

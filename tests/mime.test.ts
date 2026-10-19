import { describe, expect, it } from 'vitest';
import { categoryFor } from '../src/lib/classify/kinds';
import { imageDimensions, sniffMime } from '../src/lib/classify/sniff';
import { PNG } from './helpers';

describe('content identification', () => {
  it('identifies common file signatures', () => {
    expect(sniffMime(PNG).extension).toBe('png');
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xd9])).extension).toBe('jpg');
    expect(sniffMime(Buffer.from('GIF89a', 'ascii')).extension).toBe('gif');
    expect(sniffMime(Buffer.from('%PDF-1.4', 'ascii')).extension).toBe('pdf');
    expect(sniffMime(Buffer.from('wOF2rest', 'ascii')).extension).toBe('woff2');
    expect(sniffMime(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom')])).extension).toBe('mp4');
    expect(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).mime).toBe('image/svg+xml');
    expect(imageDimensions(PNG)).toEqual({ width: 1, height: 1 });
  });

  it('classifies by extension before a generic MIME type and skips HTML', () => {
    expect(categoryFor('application/octet-stream', 'png')).toBe('images');
    expect(categoryFor('text/css', '')).toBe('styles');
    expect(categoryFor('application/javascript', '')).toBe('scripts');
    expect(categoryFor('font/woff2', '')).toBe('fonts');
    expect(categoryFor('text/html', 'html')).toBeNull();
    expect(categoryFor('', 'mp4')).toBe('videos');
  });
});

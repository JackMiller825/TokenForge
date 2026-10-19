import { chromium } from 'playwright';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

describe('replacement comparison', () => {
  it('shows the reference and replacement in a browser and moves the slider', async () => {
    const before = (await sharp({ create: { width: 40, height: 20, channels: 3, background: '#2244aa' } }).png().toBuffer()).toString('base64');
    const after = (await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 198, g: 241, b: 53, alpha: 1 } } }).png().toBuffer()).toString('base64');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 900, height: 600 }, reducedMotion: 'reduce' });
    await page.setContent(`<!doctype html><main>
      <p>Screenshot mockup. This overlay is not a rebuilt webpage.</p>
      <img alt="Reference" src="data:image/png;base64,${before}" />
      <img alt="Replacement" src="data:image/png;base64,${after}" />
      <input aria-label="Before and after" type="range" min="0" max="100" value="50" />
    </main>`);
    expect(await page.getByAltText('Replacement').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(40);
    expect(await page.getByAltText('Reference').evaluate((image: HTMLImageElement) => image.naturalHeight)).toBe(20);
    await page.getByLabel('Before and after').fill('30');
    expect(await page.getByLabel('Before and after').inputValue()).toBe('30');
    expect(await page.getByText('not a rebuilt webpage').count()).toBe(1);
    await browser.close();
  });
});

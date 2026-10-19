import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { emptyIdentity } from '../src/lib/identity/model';
import { contractLabel, PREVIEW_NOTE, tokenomicsPreview } from '../src/lib/identity/preview';
import { sanitizeRichText } from '../src/lib/identity/sanitize';

describe('identity preview', () => {
  it('shows planned tokenomics and keeps typed ticker capitalization', async () => {
    const doc = emptyIdentity('project', 'Old Meme Coin', 'https://example.com/');
    doc.token.name = 'New Cat';
    doc.token.ticker = 'AbC';
    const copy = sanitizeRichText('<p>Hello <strong>AbC</strong></p><script>alert(1)</script>');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion: 'reduce' });
    await page.setContent(`<!doctype html><main>
      <p>${PREVIEW_NOTE}</p>
      <p>${contractLabel(doc)}</p>
      <ul>${tokenomicsPreview(doc).map((line) => `<li>${line}</li>`).join('')}</ul>
      <div id="story">${copy}</div>
      <label>Ticker <input aria-label="Ticker" value="AbC" /></label>
      <button type="button">Mobile</button>
    </main>`);
    expect(await page.getByText('not a generated website').count()).toBe(1);
    expect(await page.getByText('Coming soon. No contract address is published.').count()).toBe(1);
    expect(await page.getByText(/planned, not verified/).count()).toBe(2);
    expect(await page.locator('script').count()).toBe(0);
    expect(await page.locator('#story strong').innerText()).toBe('AbC');
    await page.getByLabel('Ticker').fill('AbC');
    expect(await page.getByLabel('Ticker').inputValue()).toBe('AbC');
    await page.getByRole('button', { name: 'Mobile' }).click();
    await browser.close();
  });
});

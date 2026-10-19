import type { IdentityDocument } from './model';

export interface ConsistencyCheck {
  code: string;
  severity: 'pass' | 'warn';
  message: string;
}

const STOP = new Set(['the', 'and', 'for', 'with', 'coin', 'token', 'website', 'official']);

export function brandReport(doc: IdentityDocument, textAssets: { id: string; filename: string }[] = []): ConsistencyCheck[] {
  const checks: ConsistencyCheck[] = [];
  const name = doc.token.name.trim();
  const ticker = doc.token.ticker.trim();
  const blob = collectText(doc);
  if (name && blob.includes(name)) checks.push({ code: 'name', severity: 'pass', message: `The name ${name} appears in the written content.` });
  else if (name) checks.push({ code: 'name', severity: 'warn', message: `The name ${name} is configured but missing from headings and story fields.` });
  if (ticker && blob.includes(ticker)) checks.push({ code: 'ticker', severity: 'pass', message: `The ticker ${ticker} appears with the capitalization you set.` });
  else if (ticker) checks.push({ code: 'ticker', severity: 'warn', message: `The ticker ${ticker} is not used in the written content yet.` });
  const stale = staleReferenceWords(doc.referenceTitle, name, ticker).filter((word) => !doc.exceptions.includes(word) && blob.toLowerCase().includes(word.toLowerCase()));
  for (const word of stale) checks.push({ code: 'stale-name', severity: 'warn', message: `“${word}” looks like reference branding. Approve an exception or rewrite it.` });
  const addresses = blob.match(/0x[a-fA-F0-9]{40}/g) || [];
  for (const address of addresses) {
    if (address.toLowerCase() !== doc.token.contractAddress.trim().toLowerCase()) {
      checks.push({ code: 'stale-address', severity: 'warn', message: `${address} is not the configured contract. Remove it or approve an exception.` });
    }
  }
  if (!doc.links.some((link) => link.enabled && (link.status === 'coming-soon' || link.url))) {
    checks.push({ code: 'links', severity: 'warn', message: 'No official links are enabled. Coming Soon is allowed. TokenForge will not invent Telegram or X addresses.' });
  } else checks.push({ code: 'links', severity: 'pass', message: 'At least one official link has an explicit state.' });
  if (doc.tokenomics.liquidityEvidence !== 'verified') checks.push({ code: 'claim', severity: 'warn', message: 'Liquidity is not verified. Previews must say planned or pending.' });
  else checks.push({ code: 'claim', severity: 'pass', message: 'Liquidity evidence is marked verified by you.' });
  if (doc.tokenomics.ownershipEvidence !== 'verified') checks.push({ code: 'claim', severity: 'warn', message: 'Ownership is not verified. Previews must say planned or pending.' });
  for (const asset of textAssets) {
    checks.push({ code: 'image-text', severity: 'warn', message: `${asset.filename} was marked as containing text. A still image is not rewritten automatically.` });
  }
  if (!checks.some((check) => check.severity === 'warn')) checks.push({ code: 'clear', severity: 'pass', message: 'No branding warnings are open.' });
  return checks;
}

export function collectText(doc: IdentityDocument): string {
  const parts = [
    doc.token.name, doc.token.ticker, doc.token.tagline, doc.token.shortDescription, doc.token.longDescription,
    doc.token.websiteTitle, doc.token.seoDescription, doc.seo.ogTitle, doc.seo.ogDescription,
    ...Object.values(doc.narrative),
    ...doc.sections.flatMap((section) => [section.displayName, section.headline, section.subheadline, section.description, section.body, section.mobileCopy, section.primaryButton, section.secondaryButton]),
  ];
  return parts.join('\n');
}

export function staleReferenceWords(referenceTitle: string, name: string, ticker: string): string[] {
  const keep = new Set(`${name} ${ticker}`.toLowerCase().split(/[^a-z0-9]+/));
  return [...new Set(referenceTitle.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 3 && !STOP.has(word.toLowerCase()) && !keep.has(word.toLowerCase())))];
}

export function qualifyClaim(label: string, evidence: string): string {
  if (evidence === 'verified') return `${label} (marked verified by you)`;
  if (evidence === 'pending-verification') return `${label} (pending verification)`;
  if (evidence === 'not-applicable') return `${label} (not applicable)`;
  return `${label} (planned, not verified)`;
}

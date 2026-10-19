import { qualifyClaim } from './consistency';
import type { IdentityDocument } from './model';
import { safeUrl } from './validate';

export function contractLabel(doc: IdentityDocument): string {
  if (doc.token.contractStatus === 'coming-soon') return 'Coming soon. No contract address is published.';
  if (doc.token.contractStatus === 'unverified') return 'Address entered. Not verified. Not deployed.';
  return 'Address configured. This card does not call the contract deployed.';
}

export function tokenomicsPreview(doc: IdentityDocument): string[] {
  const tokenomics = doc.tokenomics;
  return [
    `Total supply ${tokenomics.totalSupply} (website copy, not a chain reading)`,
    `Buy tax ${tokenomics.buyTax} (website copy)`,
    `Sell tax ${tokenomics.sellTax} (website copy)`,
    qualifyClaim(`Liquidity ${tokenomics.liquidityLabel}`, tokenomics.liquidityEvidence),
    qualifyClaim(`Ownership ${tokenomics.ownershipLabel}`, tokenomics.ownershipEvidence),
  ];
}

export function visibleLinks(doc: IdentityDocument, location: 'header' | 'hero' | 'body' | 'footer') {
  return doc.links.filter((link) => link.enabled && link.locations.includes(location)).map((link) => ({
    id: link.id,
    label: link.label || link.type,
    href: link.status === 'configured' && safeUrl(link.url) ? link.url : '',
    comingSoon: link.status === 'coming-soon',
  }));
}

export const PREVIEW_NOTE = 'Content preview and blueprint overlay. This is not a generated website.';

import { NETWORKS, TONES, type Evidence, type IdentityDocument, type OfficialLink } from './model';

const EVM = /^0x[a-fA-F0-9]{40}$/;
const TICKER = /^[A-Za-z0-9]{1,12}$/;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function solanaAddress(value: string): boolean {
  return value.length >= 32 && value.length <= 44 && [...value].every((character) => BASE58.includes(character));
}

export interface FieldIssue {
  code: string;
  severity: 'block' | 'warn';
  field: string;
  message: string;
}

export function networkKind(networkId: string): 'evm' | 'solana' | 'custom' {
  return NETWORKS.find((network) => network.id === networkId)?.kind || 'custom';
}

export function addressValid(networkId: string, address: string): boolean {
  const kind = networkKind(networkId);
  if (kind === 'evm') return EVM.test(address);
  if (kind === 'solana') return solanaAddress(address);
  return address.trim().length >= 8 && address.trim().length <= 120 && !/\s/.test(address);
}

export function safeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateIdentity(doc: IdentityDocument): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const token = doc.token;
  if (token.name && token.name.trim().length > 80) issues.push({ code: 'name', severity: 'block', field: 'token.name', message: 'The token name must be 80 characters or fewer.' });
  if (token.ticker && !TICKER.test(token.ticker)) issues.push({ code: 'ticker', severity: 'block', field: 'token.ticker', message: 'The ticker must be 1–12 letters or numbers, with the capitalization you typed.' });
  if (token.contractStatus === 'coming-soon' && token.contractAddress.trim()) {
    issues.push({ code: 'contract', severity: 'block', field: 'token.contractAddress', message: 'A Coming Soon contract cannot also contain an address. Clear the address or change the status.' });
  }
  if (token.contractStatus !== 'coming-soon') {
    if (!token.contractAddress.trim()) issues.push({ code: 'contract', severity: 'block', field: 'token.contractAddress', message: 'Enter an address or mark the contract as Coming Soon.' });
    else if (!addressValid(token.networkId, token.contractAddress.trim())) issues.push({ code: 'contract', severity: 'block', field: 'token.contractAddress', message: `That address does not match ${token.networkId === 'custom' ? token.customNetwork || 'the custom network' : token.networkId}.` });
    if (token.contractStatus === 'unverified') issues.push({ code: 'unverified', severity: 'warn', field: 'token.contractStatus', message: 'This address is configured and not verified. The preview must not call it deployed.' });
  }
  if (token.networkId === 'custom' && !token.customNetwork.trim()) issues.push({ code: 'network', severity: 'block', field: 'token.customNetwork', message: 'Name the custom network.' });
  if (doc.tokenomics.liquidityEvidence !== 'verified' && /burned/i.test(doc.tokenomics.liquidityLabel)) {
    issues.push({ code: 'liquidity', severity: 'warn', field: 'tokenomics.liquidityEvidence', message: 'Liquidity is labeled burned, but the evidence status is not verified. The preview will call this planned.' });
  }
  if (doc.tokenomics.ownershipEvidence !== 'verified' && /renounc/i.test(doc.tokenomics.ownershipLabel)) {
    issues.push({ code: 'ownership', severity: 'warn', field: 'tokenomics.ownershipEvidence', message: 'Ownership is labeled renounced, but the evidence status is not verified. The preview will call this planned.' });
  }
  for (const link of doc.links) issues.push(...validateLink(link));
  if (doc.seo.canonicalUrl && !safeUrl(doc.seo.canonicalUrl)) issues.push({ code: 'canonical', severity: 'block', field: 'seo.canonicalUrl', message: 'The canonical URL must be an http or https address.' });
  if (doc.token.seoDescription.length > 180) issues.push({ code: 'seo', severity: 'warn', field: 'token.seoDescription', message: 'The SEO description is longer than 180 characters.' });
  if (doc.seo.ogDescription.length > 200) issues.push({ code: 'og', severity: 'warn', field: 'seo.ogDescription', message: 'The sharing description is longer than 200 characters.' });
  return issues;
}

export function mediaIssues(doc: IdentityDocument, assets: { id: string; width?: number; height?: number }[]): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const favicon = assets.find((asset) => asset.id === doc.token.faviconAssetId);
  if (doc.token.faviconAssetId && favicon?.width && favicon.height && favicon.width !== favicon.height) {
    issues.push({ code: 'favicon', severity: 'warn', field: 'token.faviconAssetId', message: 'The selected favicon is not square.' });
  }
  const share = assets.find((asset) => asset.id === doc.seo.shareImageAssetId);
  if (doc.seo.shareImageAssetId && share?.width && share.height && (share.width < 600 || share.height < 315)) {
    issues.push({ code: 'share-image', severity: 'warn', field: 'seo.shareImageAssetId', message: 'The sharing image is smaller than 600 by 315.' });
  }
  return issues;
}

export function evidenceValue(value: string): Evidence {
  if (value === 'pending-verification' || value === 'verified' || value === 'not-applicable' || value === 'planned') return value;
  return 'planned';
}

export function toneValue(value: string) {
  return TONES.some((tone) => tone.id === value) ? value as IdentityDocument['narrative']['tone'] : 'none';
}

export function validateLink(link: OfficialLink): FieldIssue[] {
  if (link.status === 'coming-soon') {
    if (link.url.trim()) return [{ code: 'link', severity: 'block', field: `links.${link.id}`, message: `${link.label || link.type} is Coming Soon and should not include a URL yet.` }];
    return [];
  }
  if (link.enabled && !safeUrl(link.url)) return [{ code: 'link', severity: 'block', field: `links.${link.id}`, message: `${link.label || link.type} needs an http or https URL, or Coming Soon.` }];
  return [];
}

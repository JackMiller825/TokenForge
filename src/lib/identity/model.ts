export const IDENTITY_SCHEMA = '4.0.0' as const;

export const NETWORKS = [
  { id: 'ethereum', label: 'Ethereum', kind: 'evm' },
  { id: 'base', label: 'Base', kind: 'evm' },
  { id: 'bnb', label: 'BNB Chain', kind: 'evm' },
  { id: 'solana', label: 'Solana', kind: 'solana' },
] as const;

export type Evidence = 'planned' | 'pending-verification' | 'verified' | 'not-applicable';
export type ContractStatus = 'coming-soon' | 'configured' | 'unverified';
export type LaunchStatus = 'coming-soon' | 'planned' | 'live';
export type Tone = 'none' | 'funny' | 'bold' | 'cute' | 'cinematic' | 'gaming' | 'sports' | 'retro' | 'minimal';
export type LinkType = 'website' | 'telegram' | 'x' | 'discord' | 'dextools' | 'dexscreener' | 'explorer' | 'dex' | 'coingecko' | 'coinmarketcap' | 'custom';
export type LinkLocation = 'header' | 'hero' | 'body' | 'footer';

export interface TokenProfile {
  name: string;
  ticker: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  networkId: string;
  customNetwork: string;
  contractAddress: string;
  contractStatus: ContractStatus;
  launchStatus: LaunchStatus;
  websiteTitle: string;
  seoDescription: string;
  faviconAssetId: string;
}

export interface Tokenomics {
  totalSupply: string;
  buyTax: string;
  sellTax: string;
  liquidityLabel: string;
  ownershipLabel: string;
  liquidityEvidence: Evidence;
  ownershipEvidence: Evidence;
}

export interface Narrative {
  tone: Tone;
  origin: string;
  mascot: string;
  personality: string;
  project: string;
  moments: string;
  community: string;
  voice: string;
  slogans: string;
  callsToAction: string;
  faqs: string;
  roadmap: string;
}

export interface SectionCopy {
  id: string;
  sourceSectionId: string | null;
  order: number;
  hidden: boolean;
  displayName: string;
  purpose: string;
  headline: string;
  subheadline: string;
  description: string;
  body: string;
  mobileCopy: string;
  primaryButton: string;
  secondaryButton: string;
  buttonDestination: string;
  assetIds: string[];
  backgroundAssetId: string;
  notes: string;
  duplicated: boolean;
}

export interface OfficialLink {
  id: string;
  type: LinkType;
  label: string;
  url: string;
  enabled: boolean;
  status: 'coming-soon' | 'configured';
  locations: LinkLocation[];
  icon: string;
}

export interface SeoSettings {
  ogTitle: string;
  ogDescription: string;
  shareImageAssetId: string;
  canonicalUrl: string;
  robots: 'index,follow' | 'noindex,nofollow';
  structuredData: 'none' | 'website';
}

export interface Appearance {
  accent: string;
  background: string;
  text: string;
  fontFamily: string;
}

export interface IdentityRevision {
  id: string;
  at: string;
  label: string;
}

export interface IdentityDocument {
  schemaVersion: '4.0.0';
  projectId: string;
  updatedAt: string;
  referenceTitle: string;
  referenceUrl: string;
  token: TokenProfile;
  tokenomics: Tokenomics;
  narrative: Narrative;
  sections: SectionCopy[];
  links: OfficialLink[];
  seo: SeoSettings;
  appearance: Appearance;
  exceptions: string[];
  approvedFields: string[];
  revisions: IdentityRevision[];
}

export function emptyIdentity(projectId: string, referenceTitle = '', referenceUrl = ''): IdentityDocument {
  return {
    schemaVersion: '4.0.0',
    projectId,
    updatedAt: new Date().toISOString(),
    referenceTitle,
    referenceUrl,
    token: {
      name: '',
      ticker: '',
      tagline: '',
      shortDescription: '',
      longDescription: '',
      networkId: 'solana',
      customNetwork: '',
      contractAddress: '',
      contractStatus: 'coming-soon',
      launchStatus: 'coming-soon',
      websiteTitle: '',
      seoDescription: '',
      faviconAssetId: '',
    },
    tokenomics: {
      totalSupply: '1000000000',
      buyTax: '0%',
      sellTax: '0%',
      liquidityLabel: 'Burned',
      ownershipLabel: 'Renounced',
      liquidityEvidence: 'planned',
      ownershipEvidence: 'planned',
    },
    narrative: {
      tone: 'none',
      origin: '',
      mascot: '',
      personality: '',
      project: '',
      moments: '',
      community: '',
      voice: '',
      slogans: '',
      callsToAction: '',
      faqs: '',
      roadmap: '',
    },
    sections: [],
    links: [],
    seo: { ogTitle: '', ogDescription: '', shareImageAssetId: '', canonicalUrl: '', robots: 'index,follow', structuredData: 'none' },
    appearance: { accent: '#c6f135', background: '#07090d', text: '#e7edf6', fontFamily: 'Outfit' },
    exceptions: [],
    approvedFields: [],
    revisions: [],
  };
}

export const LINK_TYPES: { id: LinkType; label: string }[] = [
  { id: 'website', label: 'Website' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'x', label: 'X / Twitter' },
  { id: 'discord', label: 'Discord' },
  { id: 'dextools', label: 'DexTools' },
  { id: 'dexscreener', label: 'DexScreener' },
  { id: 'explorer', label: 'Explorer' },
  { id: 'dex', label: 'DEX' },
  { id: 'coingecko', label: 'CoinGecko' },
  { id: 'coinmarketcap', label: 'CoinMarketCap' },
  { id: 'custom', label: 'Custom' },
];

export const TONES: { id: Tone; label: string }[] = [
  { id: 'none', label: 'No preset' },
  { id: 'funny', label: 'Funny and absurd' },
  { id: 'bold', label: 'Bold and energetic' },
  { id: 'cute', label: 'Cute and playful' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'sports', label: 'Sports' },
  { id: 'retro', label: 'Retro internet' },
  { id: 'minimal', label: 'Professional minimal' },
];

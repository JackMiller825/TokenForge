import type { ManifestFile } from './types';

/**
 * Handoff contracts for later TokenForge modules.
 * The asset manifest still stores null in every slot.
 * Module 02 writes its own blueprint package instead of filling this slot.
 */
export interface WebsiteAnalyzerHandoff {
  referenceUrl: string;
  screenshots: string[];
  sections: unknown[];
  colors: string[];
  typography: string[];
  motions: string[];
}

export interface AssetReplacementHandoff {
  schemaVersion?: '3.0.0';
  mappings: { assetId: string; replacementPath: string; derivedPath?: string; state?: string; role?: string }[];
  readiness?: 'draft' | 'ready';
}

export interface TokenIdentity {
  name: string;
  ticker: string;
  chain: string;
  network: string;
  contractAddress: string;
  supply: string;
  taxes: { buy?: string; sell?: string };
  liquidityStatus: string;
  ownershipStatus: string;
  socials: Record<string, string>;
  copy: Record<string, string>;
}

export interface WebsiteGeneratorHandoff {
  manifest: ManifestFile;
  identity: TokenIdentity;
  replacements: AssetReplacementHandoff;
  analysis: WebsiteAnalyzerHandoff | null;
  placement?: { assetId: string; sectionId: string | null; objectFit: string; objectPosition: string }[];
  interactions?: { id: string; selector: string; trigger: string }[];
}

export interface VisualComparisonHandoff {
  referenceUrl: string;
  generatedUrl: string;
  viewports: string[];
}

export interface ModuleSlots {
  websiteAnalyzer: null;
  assetReplacementStudio: null;
  tokenIdentityStudio: null;
  websiteGenerator: null;
  visualComparison: null;
}

export const EMPTY_MODULES: ModuleSlots = {
  websiteAnalyzer: null,
  assetReplacementStudio: null,
  tokenIdentityStudio: null,
  websiteGenerator: null,
  visualComparison: null,
};

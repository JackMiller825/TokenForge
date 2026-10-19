import type { ManifestFile } from './types';

/**
 * Handoff contracts for later TokenForge modules.
 * Module 01 stores null in every slot and does not run these modules.
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
  mappings: { assetId: string; replacementPath: string }[];
}

export interface TokenIdentity {
  name: string;
  ticker: string;
  chain: string;
  contractAddress: string;
  supply: string;
  taxes: { buy?: string; sell?: string };
  liquidityStatus: string;
  socials: Record<string, string>;
  copy: Record<string, string>;
}

export interface WebsiteGeneratorHandoff {
  manifest: ManifestFile;
  identity: TokenIdentity;
  replacements: AssetReplacementHandoff;
  analysis: WebsiteAnalyzerHandoff | null;
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

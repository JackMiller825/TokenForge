import type { IdentityDocument, SectionCopy, Tone } from './model';

export interface ContentSuggestion {
  field: string;
  text: string;
  kind: 'template';
  reason: string;
}

const VOICE: Record<Tone, string> = {
  none: 'plain',
  funny: 'absurd and playful',
  bold: 'loud and direct',
  cute: 'warm and playful',
  cinematic: 'dramatic and visual',
  gaming: 'like a game lobby',
  sports: 'like a sports chant',
  retro: 'like an old internet homepage',
  minimal: 'short and calm',
};

export function suggestionsFor(doc: IdentityDocument): ContentSuggestion[] {
  const name = doc.token.name.trim() || 'the token';
  const ticker = doc.token.ticker.trim() || 'TICKER';
  const voice = VOICE[doc.narrative.tone];
  const sport = doc.narrative.tone === 'sports';
  const items: ContentSuggestion[] = [
    { field: 'token.tagline', text: sport ? `${name} is in the game.` : `${name}. ${ticker}.`, kind: 'template', reason: `A ${voice} tagline template.` },
    { field: 'token.shortDescription', text: sport ? `${name} ($${ticker}) puts the mascot on the court. Supply and taxes below are planned website copy, not a promise.` : `${name} ($${ticker}) is the new site identity. Details below are planned copy until you verify them.`, kind: 'template', reason: 'Short description template. It does not claim performance.' },
    { field: 'token.seoDescription', text: `${name} ($${ticker}) — website for the project. Not an offer or a return.`, kind: 'template', reason: 'SEO template under 180 characters when the name is short.' },
    { field: 'seo.ogTitle', text: doc.token.websiteTitle || name, kind: 'template', reason: 'Sharing title follows the website title.' },
    { field: 'narrative.callsToAction', text: sport ? `Join the ${name} huddle.` : `Meet ${name}.`, kind: 'template', reason: 'Call to action template.' },
  ];
  for (const section of doc.sections) {
    if (section.purpose === 'hero' || section.purpose === 'header') {
      items.push({ field: `sections.${section.id}.headline`, text: sport ? `${name} takes the floor` : name, kind: 'template', reason: `Headline template for the ${section.purpose} section.` });
      items.push({ field: `sections.${section.id}.primaryButton`, text: sport ? 'See the play' : 'Enter', kind: 'template', reason: 'Button label template.' });
    }
    if (section.purpose === 'community') {
      items.push({ field: `sections.${section.id}.headline`, text: `The ${name} crowd`, kind: 'template', reason: 'Community title template.' });
    }
  }
  return items;
}

export function applyEmptySuggestions(doc: IdentityDocument, suggestions = suggestionsFor(doc)): { document: IdentityDocument; applied: string[] } {
  const next = structuredClone(doc);
  const applied: string[] = [];
  for (const suggestion of suggestions) {
    if (doc.approvedFields.includes(suggestion.field)) continue;
    if (readField(next, suggestion.field).trim()) continue;
    writeField(next, suggestion.field, suggestion.text);
    applied.push(suggestion.field);
  }
  return { document: next, applied };
}

export function readField(doc: IdentityDocument, field: string): string {
  if (field.startsWith('sections.')) {
    const [, id, key] = field.split('.');
    const section = doc.sections.find((item) => item.id === id);
    return section ? String(section[key as keyof SectionCopy] ?? '') : '';
  }
  const [group, key] = field.split('.');
  const bag = (doc as unknown as Record<string, Record<string, string>>)[group];
  return bag && key ? String(bag[key] ?? '') : '';
}

export interface ContentProvider {
  id: string;
  suggest(doc: IdentityDocument): Promise<ContentSuggestion[]>;
}

export const ruleProvider: ContentProvider = {
  id: 'rules',
  async suggest(doc) {
    return suggestionsFor(doc);
  },
};

export function writeField(doc: IdentityDocument, field: string, value: string) {
  if (field.startsWith('sections.')) {
    const [, id, key] = field.split('.');
    const section = doc.sections.find((item) => item.id === id);
    if (section && key in section && typeof section[key as keyof SectionCopy] === 'string') {
      (section as unknown as Record<string, string>)[key] = value;
    }
    return;
  }
  const [group, key] = field.split('.');
  const bag = (doc as unknown as Record<string, Record<string, string>>)[group];
  if (bag && key in bag) bag[key] = value;
}

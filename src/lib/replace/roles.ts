import type { AssetRole, ScopeDecision } from './model';
import type { CatalogItem } from './model';

const SOCIAL = ['twitter', 'telegram', 'discord', 'x.com', 'github', 'instagram'];

export function inferReferenceRole(item: CatalogItem): { role: AssetRole; confidence: number; reason: string } {
  const name = `${item.filename} ${item.url}`.toLowerCase();
  const wide = item.width && item.height ? item.width / item.height >= 2.2 : false;
  const small = item.width && item.height ? Math.max(item.width, item.height) <= 128 : false;
  if (item.category === 'fonts' || /\.(woff2?|ttf|otf)$/i.test(item.filename)) {
    return { role: 'font', confidence: 0.9, reason: 'The file is a font.' };
  }
  if (item.category === 'videos' || item.kind === 'video') {
    return { role: 'video-background', confidence: 0.62, reason: 'The file is a video. Treat the background role as a suggestion.' };
  }
  if (item.kind === 'poster') return { role: 'video-poster', confidence: 0.7, reason: 'Phase 2 recorded this file as a video poster.' };
  if (item.animated && /gif|webp/.test(name)) return { role: 'animated-gif', confidence: 0.74, reason: 'The file is an animated image.' };
  if (SOCIAL.some((word) => name.includes(word)) && (small || name.includes('icon'))) {
    return { role: 'social-icon', confidence: 0.66, reason: 'The filename looks like a social icon.' };
  }
  if (name.includes('logo') || name.includes('mark')) return { role: 'logo', confidence: 0.7, reason: 'The filename contains logo or mark.' };
  if (name.includes('telegram') && (name.includes('banner') || wide)) return { role: 'telegram-banner', confidence: 0.68, reason: 'The filename looks like a Telegram banner.' };
  if (name.includes('banner') || name.includes('hero') || (item.sectionRole === 'hero' && wide)) {
    return { role: 'hero-banner', confidence: 0.64, reason: 'The filename or hero placement looks like a wide banner.' };
  }
  if (name.includes('mascot') || name.includes('character')) return { role: 'main-mascot', confidence: 0.72, reason: 'The filename looks like a mascot or character.' };
  if (item.kind === 'background' || item.sectionRole === 'hero' && name.includes('bg')) {
    return { role: 'background', confidence: 0.6, reason: 'Phase 2 saw this as a background image.' };
  }
  if (small || name.includes('icon')) return { role: 'icon', confidence: 0.58, reason: 'The file is small or named like an icon.' };
  if (item.sectionId) return { role: 'section-artwork', confidence: 0.42, reason: 'The file sits in a section. The role is only a guess.' };
  return { role: 'other', confidence: 0.3, reason: 'No reliable role could be inferred.' };
}

export function defaultScope(category: string): ScopeDecision {
  if (category === 'images' || category === 'videos') return 'replace';
  if (category === 'fonts') return 'preserve';
  return 'not-applicable';
}

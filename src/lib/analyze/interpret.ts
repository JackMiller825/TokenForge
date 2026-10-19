import { createHash } from 'node:crypto';
import { matchManifest } from './match';
import type { DesignSystem, InterpretedPage, ManifestRef, MotionRecord, RawProbe, RawSection, SectionRecord, SectionRole } from './model';

const ROLES = new Set<SectionRole>(['header', 'navigation', 'hero', 'content', 'gallery', 'panel', 'token', 'community', 'footer', 'sticky', 'unknown']);

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

export function inferRole(section: RawSection, index: number, pageHeight: number): { role: SectionRole; inferred: boolean; confidence: number; name: string } {
  const blob = `${section.tag} ${section.roleAttr} ${section.idAttr} ${section.className} ${section.headings.join(' ')} ${section.textSample}`.toLowerCase();
  const heading = section.headings[0];
  if (section.tag === 'header' || section.roleAttr === 'banner') return { role: 'header', inferred: false, confidence: 0.92, name: heading || 'Header' };
  if (section.box.y < 90 && /header|navbar|nav-bar|topbar/.test(blob)) return { role: 'header', inferred: true, confidence: 0.7, name: heading || 'Header' };
  if (section.tag === 'nav' || section.roleAttr === 'navigation') return { role: 'navigation', inferred: false, confidence: 0.9, name: 'Navigation' };
  if (/\bnav\b|menu/.test(blob) && section.box.height < 220) return { role: 'navigation', inferred: true, confidence: 0.62, name: 'Navigation' };
  if (section.tag === 'footer' || section.roleAttr === 'contentinfo') return { role: 'footer', inferred: false, confidence: 0.92, name: heading || 'Footer' };
  if (section.box.y > pageHeight * 0.72 && /footer/.test(blob)) return { role: 'footer', inferred: true, confidence: 0.66, name: heading || 'Footer' };
  if (section.position === 'sticky' || section.position === 'fixed') return { role: 'sticky', inferred: true, confidence: 0.8, name: heading || 'Sticky element' };
  if (/gallery|carousel|slider|masonry/.test(blob)) return { role: 'gallery', inferred: true, confidence: 0.58, name: heading || 'Gallery' };
  if (/token|contract|supply|ticker|chart/.test(blob)) return { role: 'token', inferred: true, confidence: 0.55, name: heading || 'Token information' };
  if (/community|telegram|twitter|discord|social/.test(blob)) return { role: 'community', inferred: true, confidence: 0.55, name: heading || 'Community' };
  if (/panel|dashboard|modal|drawer/.test(blob)) return { role: 'panel', inferred: true, confidence: 0.5, name: heading || 'Panel' };
  if (index <= 1 && section.box.height >= 220) return { role: 'hero', inferred: true, confidence: 0.6, name: heading || 'Hero' };
  return { role: 'content', inferred: true, confidence: 0.45, name: heading || `Section ${index + 1}` };
}

function overlaps(a: RawSection, b: RawSection): boolean {
  const x = Math.max(0, Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x));
  const y = Math.max(0, Math.min(a.box.y + a.box.height, b.box.y + b.box.height) - Math.max(a.box.y, b.box.y));
  return x > 8 && y > 8 && a.position !== 'static' && b.position !== 'static';
}

function bucket(values: string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const clean = value.trim();
    if (!clean || clean === 'none' || clean === 'normal' || clean === 'auto' || clean === '0px' || clean === 'rgba(0, 0, 0, 0)' || clean === 'transparent') continue;
    counts.set(clean, (counts.get(clean) || 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 24);
}

function px(value: string): number | null {
  const match = value.match(/(-?\d+(?:\.\d+)?)px/);
  if (!match) return null;
  const parsed = Math.round(Number(match[1]));
  return Number.isFinite(parsed) ? parsed : null;
}

function spacingValues(samples: string[]): { value: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const sample of samples) {
    for (const part of sample.split(/\s+/)) {
      const value = px(part);
      if (value == null || value < 0 || value > 240) continue;
      const snapped = Math.round(value / 4) * 4;
      counts.set(snapped, (counts.get(snapped) || 0) + 1);
    }
  }
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count).slice(0, 16);
}

export function buildDesignSystem(probe: RawProbe): DesignSystem {
  const declared = new Set(probe.variables.map((item) => item.value.trim().toLowerCase()));
  const colorCounts = new Map<string, { count: number; roles: Set<string> }>();
  const addColor = (value: string, role: string) => {
    const clean = value.trim();
    if (!clean || /transparent|rgba\(0,\s*0,\s*0,\s*0\)/.test(clean)) return;
    const current = colorCounts.get(clean) ?? { count: 0, roles: new Set<string>() };
    current.count += 1;
    current.roles.add(role);
    colorCounts.set(clean, current);
  };
  for (const style of probe.styles) {
    addColor(style.color, 'text');
    if (!style.background.includes('gradient')) addColor(style.background, 'background');
  }
  const fonts = new Map<string, DesignSystem['fonts'][number]>();
  for (const style of probe.styles) {
    const family = style.fontFamily.split(',')[0]?.replace(/["']/g, '').trim();
    if (!family) continue;
    const current = fonts.get(family) ?? { family, weights: [], sizes: [], lineHeights: [], letterSpacings: [], count: 0 };
    current.count += 1;
    for (const [list, value] of [[current.weights, style.fontWeight], [current.sizes, style.fontSize], [current.lineHeights, style.lineHeight], [current.letterSpacings, style.letterSpacing]] as const) {
      if (value && value !== 'normal' && !list.includes(value) && list.length < 8) list.push(value);
    }
    fonts.set(family, current);
  }
  const containers = [...new Set(probe.styles.map((style) => px(style.maxWidth)).filter((value): value is number => value != null && value >= 320 && value <= 1920))].sort((a, b) => a - b);
  const columns = [...new Set(probe.styles.map((style) => style.columns).filter((value) => value > 1))].sort((a, b) => a - b);
  return {
    declaredVariables: probe.variables.slice(0, 80),
    colors: [...colorCounts.entries()].map(([value, info]) => ({
      value,
      count: info.count,
      roles: [...info.roles],
      declared: declared.has(value.toLowerCase()),
    })).sort((a, b) => b.count - a.count).slice(0, 24),
    gradients: [...new Set(probe.gradients)].slice(0, 16),
    fonts: [...fonts.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    radii: bucket(probe.styles.map((style) => style.radius)),
    borders: bucket(probe.styles.map((style) => style.border)),
    shadows: bucket(probe.styles.map((style) => style.shadow)),
    containers,
    columns,
    spacing: spacingValues(probe.styles.flatMap((style) => [style.gap, style.padding, style.margin])),
    breakpoints: [...new Set(probe.breakpoints)].slice(0, 20),
  };
}

function motionsFrom(probe: RawProbe, sections: SectionRecord[]): { animations: MotionRecord[]; interactions: MotionRecord[] } {
  const sectionId = (index: number) => sections[index]?.id ?? null;
  const records = probe.motions.map((motion, index) => ({
    id: stableId('motion', `${motion.kind}|${motion.selector}|${index}`),
    kind: motion.kind,
    trigger: motion.trigger,
    duration: motion.duration || undefined,
    delay: motion.delay || undefined,
    easing: motion.easing || undefined,
    properties: motion.properties,
    selector: motion.selector,
    sectionId: sectionId(motion.sectionIndex),
    confidence: motion.confidence,
    limitation: motion.limitation || undefined,
  }));
  const interactionKinds = new Set(['hover', 'accordion', 'carousel', 'navigation', 'modal', 'scroll']);
  return {
    animations: records.filter((record) => !interactionKinds.has(record.kind)),
    interactions: records.filter((record) => interactionKinds.has(record.kind) || record.kind === 'sticky'),
  };
}

export function interpretProbe(probe: RawProbe, manifest: ManifestRef[], viewport = 'desktop'): InterpretedPage {
  const warnings: string[] = [];
  if (probe.brokenMedia) warnings.push(`${probe.brokenMedia} media elements reported a broken or empty image.`);
  if (probe.hiddenCount) warnings.push(`${probe.hiddenCount} hidden elements were ignored for section bounds.`);
  if (probe.scrollHeight > 12_000) warnings.push('The page is very long. Full-page capture is capped and marked partial.');
  const sections: SectionRecord[] = probe.sections.map((section, index) => {
    const role = inferRole(section, index, probe.scrollHeight || 1);
    const id = stableId('section', `${viewport}|${role.role}|${Math.round(section.box.y)}|${section.selector}`);
    return {
      id,
      role: ROLES.has(role.role) ? role.role : 'unknown',
      roleInferred: role.inferred,
      name: role.name,
      confidence: role.confidence,
      selector: section.selector,
      alternateSelector: section.alternateSelector,
      viewport,
      x: section.box.x,
      y: section.box.y,
      width: section.box.width,
      height: section.box.height,
      background: section.background,
      padding: section.padding,
      margin: section.margin,
      display: section.display,
      layout: section.layout,
      headings: section.headings,
      textSample: section.textSample,
      assetIds: [],
      interactiveCount: section.interactiveCount,
      overlapping: probe.sections.some((other, otherIndex) => otherIndex !== index && overlaps(section, other)),
      position: section.position,
      corrected: false,
    };
  });
  const assetMap = probe.assets.map((asset, index) => {
    const matched = matchManifest(asset.url, manifest);
    const section = sections[asset.sectionIndex] ?? null;
    const id = stableId('map', `${asset.kind}|${asset.url}|${index}`);
    if (section) section.assetIds.push(id);
    return {
      id,
      pageUrl: probe.url,
      sectionId: section?.id ?? null,
      selector: asset.selector,
      kind: asset.kind,
      sourceUrl: asset.url,
      resolvedUrl: asset.url,
      manifestAssetId: matched.id,
      match: matched.match,
      box: asset.box,
      naturalWidth: asset.naturalWidth || undefined,
      naturalHeight: asset.naturalHeight || undefined,
      objectFit: asset.objectFit,
      objectPosition: asset.objectPosition,
      opacity: asset.opacity,
      transform: asset.transform,
      borderRadius: asset.borderRadius,
      zIndex: asset.zIndex,
      animated: asset.animated,
      corrected: false,
    };
  });
  const motion = motionsFrom(probe, sections);
  return { sections, designSystem: buildDesignSystem(probe), assetMap, animations: motion.animations, interactions: motion.interactions, warnings };
}

export function compareAnalyses(left: { sections: { role: string }[]; designSystem: { colors: { value: string }[] }; assetMap: unknown[] }, right: { sections: { role: string }[]; designSystem: { colors: { value: string }[] }; assetMap: unknown[] }) {
  const leftRoles = new Set(left.sections.map((section) => section.role));
  const rightRoles = new Set(right.sections.map((section) => section.role));
  return {
    sections: { left: left.sections.length, right: right.sections.length },
    rolesAdded: [...rightRoles].filter((role) => !leftRoles.has(role)),
    rolesRemoved: [...leftRoles].filter((role) => !rightRoles.has(role)),
    colors: { left: left.designSystem.colors.length, right: right.designSystem.colors.length },
    assets: { left: left.assetMap.length, right: right.assetMap.length },
  };
}

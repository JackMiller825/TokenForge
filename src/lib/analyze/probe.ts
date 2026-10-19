import type { RawProbe } from './model';

/** Runs inside the page. It must not close over Node values. */
export function probePage(): RawProbe {
  const cssPath = (element: Element, depth = 0): string => {
    const tag = element.tagName.toLowerCase();
    if (element.id && /^[A-Za-z][\w:-]*$/.test(element.id)) return `#${CSS.escape(element.id)}`;
    if (!element.parentElement || depth > 5) return tag;
    const same = Array.from(element.parentElement.children).filter((child) => child.tagName === element.tagName);
    return `${cssPath(element.parentElement, depth + 1)} > ${tag}:nth-of-type(${same.indexOf(element) + 1})`;
  };
  const alternate = (element: Element): string => {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const classes = Array.from(element.classList).slice(0, 2).map((name) => `.${CSS.escape(name)}`).join('');
    return classes ? `${element.tagName.toLowerCase()}${classes}` : cssPath(element);
  };
  const boxOf = (element: Element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x + window.scrollX),
      y: Math.round(rect.y + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  };
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 8 && rect.height > 8 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const textOf = (element: Element) => (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const landmarks = Array.from(document.querySelectorAll('header, nav, footer, main, section, article, aside, [role="banner"], [role="navigation"], [role="contentinfo"]'));
  const inline = new Set(['P', 'SPAN', 'A', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BUTTON', 'SCRIPT', 'STYLE', 'BR', 'IMG', 'SVG']);
  const blocks = Array.from(document.body?.children || []).filter((element) => visible(element) && !inline.has(element.tagName) && element.getBoundingClientRect().height > 70);
  const candidates = [...new Set([...landmarks, ...blocks])].filter((element) => visible(element));
  const pageHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  const kept = candidates.filter((element) => {
    const rect = element.getBoundingClientRect();
    const wrapsPage = rect.height > pageHeight * 0.9 && (element.tagName === 'MAIN' || element.tagName === 'DIV');
    if (!wrapsPage) return true;
    return !candidates.some((other) => other !== element && element.contains(other));
  }).filter((element, index, list) => {
    const rect = element.getBoundingClientRect();
    return !list.some((other, otherIndex) => {
      if (other === element || otherIndex > index) return false;
      if (!other.contains(element)) return false;
      const parent = other.getBoundingClientRect();
      return rect.height > parent.height * 0.85;
    });
  }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).slice(0, 40);

  const sectionIndexFor = (element: Element) => {
    const match = kept.findIndex((section) => section.contains(element) || section === element);
    return match;
  };
  const sections = kept.map((element) => {
    const style = getComputedStyle(element);
    const headings = Array.from(element.querySelectorAll('h1, h2, h3')).map((heading) => textOf(heading)).filter(Boolean).slice(0, 4);
    return {
      selector: cssPath(element),
      alternateSelector: alternate(element),
      tag: element.tagName.toLowerCase(),
      roleAttr: element.getAttribute('role') || '',
      idAttr: element.id || '',
      className: String(element.className || '').slice(0, 160),
      headings,
      textSample: textOf(element),
      box: boxOf(element),
      background: style.backgroundColor,
      padding: style.padding,
      margin: style.margin,
      display: style.display,
      position: style.position,
      zIndex: style.zIndex,
      layout: style.display.includes('grid') ? 'grid' : style.display.includes('flex') ? 'flex' : 'block',
      interactiveCount: element.querySelectorAll('a, button, summary, input, [role="button"]').length,
    };
  });

  const assets: RawProbe['assets'] = [];
  const pushAsset = (element: Element, kind: RawProbe['assets'][number]['kind'], url: string) => {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || assets.length >= 300) return;
    const style = getComputedStyle(element);
    const animations = typeof element.getAnimations === 'function' ? element.getAnimations() : [];
    assets.push({
      selector: cssPath(element),
      kind,
      url,
      box: boxOf(element),
      naturalWidth: element instanceof HTMLImageElement ? element.naturalWidth : element instanceof HTMLVideoElement ? element.videoWidth : 0,
      naturalHeight: element instanceof HTMLImageElement ? element.naturalHeight : element instanceof HTMLVideoElement ? element.videoHeight : 0,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      opacity: style.opacity,
      transform: style.transform,
      borderRadius: style.borderRadius,
      zIndex: style.zIndex,
      animated: animations.length > 0 || (style.animationName !== 'none' && style.animationName !== ''),
      sectionIndex: sectionIndexFor(element),
    });
  };
  for (const image of Array.from(document.images)) {
    if (!visible(image) && image.getBoundingClientRect().height < 2) continue;
    pushAsset(image, image.closest('svg') ? 'svg' : 'img', image.currentSrc || image.src);
  }
  for (const video of Array.from(document.querySelectorAll('video'))) {
    if (video.poster) pushAsset(video, 'poster', video.poster);
    if (video.currentSrc) pushAsset(video, 'video', video.currentSrc);
  }
  for (const svg of Array.from(document.querySelectorAll('svg')).slice(0, 40)) {
    if (!visible(svg)) continue;
    assets.push({
      selector: cssPath(svg),
      kind: 'svg',
      url: svg.ownerDocument?.location.href || '',
      box: boxOf(svg),
      naturalWidth: 0,
      naturalHeight: 0,
      objectFit: 'fill',
      objectPosition: '50% 50%',
      opacity: getComputedStyle(svg).opacity,
      transform: getComputedStyle(svg).transform,
      borderRadius: getComputedStyle(svg).borderRadius,
      zIndex: getComputedStyle(svg).zIndex,
      animated: false,
      sectionIndex: sectionIndexFor(svg),
    });
  }
  let seenNodes = 0;
  for (const element of Array.from(document.querySelectorAll('body *'))) {
    if ((seenNodes += 1) > 1500 || assets.length >= 300) break;
    const background = getComputedStyle(element).backgroundImage;
    if (!background || !background.includes('url(')) continue;
    const match = /url\((['"]?)(.*?)\1\)/.exec(background);
    if (match?.[2]) pushAsset(element, 'background', new URL(match[2], document.baseURI).href);
  }

  const styles: RawProbe['styles'] = [];
  const nodes = Array.from(document.querySelectorAll('body *')).filter((element, index) => index % 3 === 0 && visible(element)).slice(0, 180);
  for (const element of nodes) {
    const style = getComputedStyle(element);
    const columns = style.gridTemplateColumns && style.gridTemplateColumns !== 'none' ? style.gridTemplateColumns.split(' ').filter((part) => part && part !== '/').length : 0;
    styles.push({
      color: style.color,
      background: style.backgroundColor,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      radius: style.borderRadius,
      border: style.border,
      shadow: style.boxShadow,
      maxWidth: style.maxWidth,
      gap: style.gap,
      padding: style.padding,
      margin: style.margin,
      columns,
    });
  }

  const variables: { name: string; value: string }[] = [];
  const breakpoints: string[] = [];
  const gradients: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list: CSSRuleList) => {
      for (const rule of Array.from(list)) {
        if (rule instanceof CSSMediaRule) {
          breakpoints.push(rule.conditionText.slice(0, 120));
          walk(rule.cssRules);
        }
        if (rule instanceof CSSStyleRule) {
          for (const name of Array.from(rule.style)) {
            if (name.startsWith('--') && variables.length < 80) variables.push({ name, value: rule.style.getPropertyValue(name).trim() });
          }
          const background = rule.style.backgroundImage;
          if (background.includes('gradient') && gradients.length < 16) gradients.push(background.slice(0, 180));
        }
      }
    };
    walk(rules);
  }

  const motions: RawProbe['motions'] = [];
  const pushMotion = (element: Element, motion: Omit<RawProbe['motions'][number], 'selector' | 'sectionIndex'>) => {
    if (motions.length >= 80) return;
    motions.push({ ...motion, selector: cssPath(element), sectionIndex: sectionIndexFor(element) });
  };
  for (const element of Array.from(document.querySelectorAll('body *')).slice(0, 800)) {
    const style = getComputedStyle(element);
    if (style.animationName && style.animationName !== 'none') {
      pushMotion(element, { kind: 'keyframes', trigger: 'load', duration: style.animationDuration, delay: style.animationDelay, easing: style.animationTimingFunction, properties: style.animationName.split(','), name: style.animationName, limitation: 'Observed CSS animation. The original source timing function is not recovered.', confidence: 0.74 });
    }
    if (style.transitionProperty && style.transitionProperty !== 'all' && style.transitionDuration !== '0s') {
      pushMotion(element, { kind: 'transition', trigger: 'style change', duration: style.transitionDuration, delay: style.transitionDelay, easing: style.transitionTimingFunction, properties: style.transitionProperty.split(',').map((part) => part.trim()), name: '', limitation: 'Observed transition. The event that changes the style is not always visible.', confidence: 0.6 });
    }
    if (style.position === 'sticky' || style.position === 'fixed') {
      pushMotion(element, { kind: 'sticky', trigger: 'scroll', duration: '', delay: '', easing: '', properties: ['position'], name: style.position, limitation: '', confidence: 0.86 });
    }
    if (element instanceof HTMLVideoElement && (element.autoplay || style.position === 'absolute' || style.position === 'fixed')) {
      pushMotion(element, { kind: 'video', trigger: element.autoplay ? 'autoplay' : 'playback', duration: '', delay: '', easing: '', properties: ['video'], name: '', limitation: '', confidence: 0.8 });
    }
    if (element instanceof HTMLCanvasElement) {
      pushMotion(element, { kind: 'canvas', trigger: 'script', duration: '', delay: '', easing: '', properties: ['canvas'], name: '', limitation: 'Canvas or WebGL drawing commands are not reconstructed.', confidence: 0.7 });
    }
    if (element.tagName === 'DETAILS') {
      pushMotion(element, { kind: 'accordion', trigger: 'click summary', duration: '', delay: '', easing: '', properties: ['open'], name: '', limitation: '', confidence: 0.9 });
    }
    if (element.getAttribute('role') === 'dialog' || element.tagName === 'DIALOG') {
      pushMotion(element, { kind: 'modal', trigger: 'open', duration: '', delay: '', easing: '', properties: ['dialog'], name: '', limitation: 'Presence is recorded. Opening it is not automated.', confidence: 0.7 });
    }
    const snap = style.scrollSnapType;
    const label = `${element.className} ${element.id}`;
    if ((snap && snap !== 'none') || /swiper|carousel|slider/i.test(label)) {
      pushMotion(element, { kind: 'carousel', trigger: 'scroll or control', duration: '', delay: '', easing: '', properties: ['scroll'], name: '', limitation: 'Carousel behavior is inferred from scroll-snap or a class name.', confidence: 0.48 });
    }
    if (element.hasAttribute('data-parallax') || element.hasAttribute('data-speed')) {
      pushMotion(element, { kind: 'scroll', trigger: 'scroll', duration: '', delay: '', easing: '', properties: ['transform'], name: 'parallax', limitation: 'A parallax-like attribute was found. The motion curve was not measured.', confidence: 0.4 });
    }
    if (typeof element.getAnimations === 'function') {
      for (const animation of element.getAnimations()) {
        const timing = animation.effect?.getComputedTiming?.();
        pushMotion(element, { kind: 'web-animation', trigger: 'Web Animations API', duration: timing?.duration ? `${timing.duration}ms` : '', delay: timing?.delay ? `${timing.delay}ms` : '', easing: String(timing?.easing || ''), properties: ['animation'], name: '', limitation: 'Observable Web Animations API timing. Keyframe source is not recovered.', confidence: 0.72 });
      }
    }
  }

  let brokenMedia = 0;
  for (const image of Array.from(document.images)) {
    if (image.complete && image.naturalWidth === 0 && image.src) brokenMedia += 1;
  }
  return {
    title: document.title,
    url: location.href,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: pageHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    sections,
    assets,
    styles,
    variables,
    breakpoints,
    gradients,
    motions,
    brokenMedia,
    hiddenCount: document.querySelectorAll('[hidden], [aria-hidden="true"]').length,
  };
}

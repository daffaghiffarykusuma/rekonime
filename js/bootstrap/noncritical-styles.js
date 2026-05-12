const NONCRITICAL_LINK_SELECTOR = 'link[data-noncritical]';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=optional';

const queueIdle = (callback, timeout = 2500) => {
  if (typeof callback !== 'function') return null;
  if ('requestIdleCallback' in window) {
    return requestIdleCallback(callback, { timeout });
  }
  return setTimeout(callback, 1200);
};

const enableLink = (link) => {
  if (!link || link.media === 'all') return;
  link.media = 'all';
};

const isConstrainedViewport = () => window.matchMedia?.('(max-width: 640px)').matches ?? false;

const isConstrainedConnection = () => {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const lowBandwidth = effectiveType.includes('2g') || effectiveType.includes('3g') || effectiveType === 'slow-4g';
  const lowMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  return Boolean(connection?.saveData) || lowBandwidth || lowMemory;
};

const shouldPrioritizeVisualStability = () => isConstrainedViewport() || isConstrainedConnection();

const shouldLoadCustomFonts = () => !isConstrainedViewport() && !isConstrainedConnection();

const markFontsReady = () => {
  document.documentElement?.setAttribute('data-fonts-ready', 'true');
};

const loadFontStyles = () => {
  if (document.querySelector('link[data-font-style="true"]')) return;
  if (!shouldLoadCustomFonts()) return;
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = FONT_HREF;
  fontLink.setAttribute('data-font-style', 'true');
  fontLink.addEventListener('load', () => {
    if (!document.fonts?.load) {
      markFontsReady();
      return;
    }
    Promise.allSettled([
      document.fonts.load('400 1em "Noto Sans JP"'),
      document.fonts.load('600 1em "Noto Serif JP"')
    ]).finally(() => {
      markFontsReady();
    });
  }, { once: true });
  document.head.appendChild(fontLink);
};

const scheduleFontStyles = () => {
  const start = () => queueIdle(loadFontStyles, 6000);
  window.addEventListener('pointerdown', start, { once: true, passive: true });
  window.addEventListener('keydown', start, { once: true });
  setTimeout(start, 7000);
};

const activateNoncriticalStyles = () => {
  const links = document.querySelectorAll(NONCRITICAL_LINK_SELECTOR);
  if (links.length) {
    links.forEach((link) => {
      if (link.media === 'all') return;
      link.addEventListener('load', () => enableLink(link), { once: true });
      try {
        if (link.sheet) {
          enableLink(link);
        }
      } catch {
        // Ignore cross-origin access errors
      }
      link.media = 'all';
    });
  }

  scheduleFontStyles();
};

const scheduleNoncriticalActivation = () => {
  const activate = () => queueIdle(activateNoncriticalStyles, 3000);
  if (shouldPrioritizeVisualStability()) {
    const activateAfterInitialWork = () => {
      window.setTimeout(activate, 6500);
      window.setTimeout(() => {
        window.addEventListener('pointerdown', activate, { once: true, passive: true });
        window.addEventListener('keydown', activate, { once: true });
        window.addEventListener('scroll', activate, { once: true, passive: true });
      }, 2500);
    };
    if (document.readyState === 'complete') {
      activateAfterInitialWork();
      return;
    }
    window.addEventListener('load', activateAfterInitialWork, { once: true });
    return;
  }
  if (document.readyState === 'complete') {
    activate();
    return;
  }
  window.addEventListener('load', activate, { once: true });
  setTimeout(activate, 4500);
};

scheduleNoncriticalActivation();

const NONCRITICAL_LINK_SELECTOR = 'link[data-noncritical]';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;600;700&display=optional';

const enableLink = (link) => {
  if (!link || link.media === 'all') return;
  link.media = 'all';
};

const loadFontStyles = () => {
  if (document.querySelector('link[data-font-style="true"]')) return;
  if (navigator.connection && navigator.connection.saveData) return;
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = FONT_HREF;
  fontLink.setAttribute('data-font-style', 'true');
  document.head.appendChild(fontLink);
};

const scheduleFontStyles = () => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadFontStyles, { timeout: 4000 });
    return;
  }
  setTimeout(loadFontStyles, 1200);
};

const activateNoncriticalStyles = () => {
  const links = document.querySelectorAll(NONCRITICAL_LINK_SELECTOR);
  if (!links.length) return;

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
  });

  scheduleFontStyles();
};

if ('requestAnimationFrame' in window) {
  requestAnimationFrame(() => {
    requestAnimationFrame(activateNoncriticalStyles);
  });
} else {
  setTimeout(activateNoncriticalStyles, 0);
}

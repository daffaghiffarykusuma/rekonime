import { JSDOM } from 'jsdom';

const defaultHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="theme-color" content="#1A1418" />
  </head>
  <body>
    <div id="app-container"></div>
  </body>
</html>`;

const installMatchMedia = (window) => {
  if (typeof window.matchMedia === 'function') return;
  window.matchMedia = (query) => ({
    matches: false,
    media: String(query || ''),
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false
  });
};

const installAnimationFrames = (window) => {
  if (typeof window.requestAnimationFrame !== 'function') {
    window.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  }
  if (typeof window.cancelAnimationFrame !== 'function') {
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  }
  if (typeof window.requestIdleCallback !== 'function') {
    window.requestIdleCallback = (callback) => setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 0);
  }
  if (typeof window.cancelIdleCallback !== 'function') {
    window.cancelIdleCallback = (id) => clearTimeout(id);
  }
};

const installScrollHelpers = (window) => {
  if (typeof window.scrollTo !== 'function') {
    window.scrollTo = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
};

const installIntersectionObserver = (window) => {
  if (typeof window.IntersectionObserver === 'function') return;
  class FakeIntersectionObserver {
    constructor(callback, options = {}) {
      this.callback = callback;
      this.options = options;
      this.elements = new Set();
    }

    observe(element) {
      if (element) {
        this.elements.add(element);
      }
    }

    unobserve(element) {
      this.elements.delete(element);
    }

    disconnect() {
      this.elements.clear();
    }
  }
  window.IntersectionObserver = FakeIntersectionObserver;
};

const installCssEscape = (window) => {
  if (!window.CSS) {
    window.CSS = {};
  }
  if (typeof window.CSS.escape !== 'function') {
    window.CSS.escape = (value) => String(value).replace(/["\\]/g, '\\$&');
  }
};

export const setupDom = (html = defaultHtml, { url = 'http://localhost/' } = {}) => {
  const dom = new JSDOM(html, {
    url,
    pretendToBeVisual: true,
    runScripts: 'dangerously'
  });

  const { window } = dom;
  const defineGlobal = (key, value) => {
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true
    });
  };

  defineGlobal('window', window);
  defineGlobal('document', window.document);
  defineGlobal('navigator', window.navigator);
  defineGlobal('Node', window.Node);
  defineGlobal('HTMLElement', window.HTMLElement);
  defineGlobal('CustomEvent', window.CustomEvent);
  defineGlobal('Event', window.Event);
  defineGlobal('MouseEvent', window.MouseEvent);
  defineGlobal('KeyboardEvent', window.KeyboardEvent);
  defineGlobal('getComputedStyle', window.getComputedStyle.bind(window));

  installMatchMedia(window);
  installAnimationFrames(window);
  installScrollHelpers(window);
  installIntersectionObserver(window);
  installCssEscape(window);

  defineGlobal('requestAnimationFrame', window.requestAnimationFrame.bind(window));
  defineGlobal('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
  defineGlobal('requestIdleCallback', window.requestIdleCallback.bind(window));
  defineGlobal('cancelIdleCallback', window.cancelIdleCallback.bind(window));

  defineGlobal('localStorage', window.localStorage);
  defineGlobal('sessionStorage', window.sessionStorage);

  return dom;
};

export const resetDomBody = (html = '') => {
  if (!globalThis.document) return;
  document.body.innerHTML = html;
};

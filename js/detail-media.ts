// @ts-nocheck
import {
  buildTrailerUrls,
  resolveTrustedTrailerMessageOrigin,
  sanitizeTrailerEmbedUrl
} from './security/trailer-url-policy.ts';
import {
  insertHTML,
  replaceOuterHTML
} from './security/trusted-types.js';

const createDetailMedia = ({
  escapeAttr,
  shouldEmbedTrailers,
  shouldAutoplayTrailers
}) => {
  let observer = null;
  let scrollRoot = null;
  let scrollHandler = null;

  const buildEmbedUrlWithApi = (embedUrl) => {
    const safeEmbedUrl = sanitizeTrailerEmbedUrl(embedUrl);
    if (!safeEmbedUrl) return '';

    try {
      const url = new URL(safeEmbedUrl);
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('playsinline', '1');
      return url.toString();
    } catch {
      return '';
    }
  };

  const buildAutoplayEmbedUrl = (embedUrl) => {
    const safeEmbedUrl = buildEmbedUrlWithApi(embedUrl);
    if (!safeEmbedUrl) return '';

    const url = new URL(safeEmbedUrl);
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('mute', '1');
    return url.toString();
  };

  const setControlState = (isPaused) => {
    const button = document.getElementById('trailer-toggle');
    if (!button) return;
    const label = isPaused ? 'Play trailer' : 'Pause trailer';
    button.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    const text = button.querySelector('.trailer-control-label');
    if (text) text.textContent = isPaused ? 'Play' : 'Pause';
  };

  const setPaused = (iframe, isPaused) => {
    if (!iframe) return;
    iframe.dataset.paused = isPaused ? '1' : '';
    setControlState(isPaused);
  };

  const sendCommand = (iframe, command) => {
    if (!iframe?.contentWindow) return;
    const rawUrl = iframe.dataset.embedSrc || iframe.getAttribute('src') || '';
    const targetOrigin = resolveTrustedTrailerMessageOrigin(rawUrl, window.location.href);
    if (!targetOrigin) return;
    iframe.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: command,
      args: []
    }), targetOrigin);
  };

  const loadEmbed = (iframe) => {
    if (!iframe || iframe.dataset.embedLoaded === '1') return;
    const safeEmbedSrc = buildEmbedUrlWithApi(iframe.dataset.embedSrc);
    if (!safeEmbedSrc) return;
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = safeEmbedSrc;
    setPaused(iframe, true);
  };

  const pause = (iframe) => {
    if (!iframe?.dataset.embedSrc) return;
    sendCommand(iframe, 'pauseVideo');
    const safeEmbedSrc = buildEmbedUrlWithApi(iframe.dataset.embedSrc);
    if (safeEmbedSrc) {
      iframe.dataset.embedLoaded = '1';
      iframe.removeAttribute('loading');
      iframe.src = safeEmbedSrc;
    }
    iframe.dataset.autoplayStarted = '';
    setPaused(iframe, true);
  };

  const resume = (iframe) => {
    if (!iframe?.dataset.embedSrc) return;
    const safeEmbedSrc = buildAutoplayEmbedUrl(iframe.dataset.embedSrc)
      || buildEmbedUrlWithApi(iframe.dataset.embedSrc);
    if (!safeEmbedSrc) return;
    iframe.dataset.autoplayStarted = '1';
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = safeEmbedSrc;
    setPaused(iframe, false);
  };

  const toggle = () => {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    if (iframe.dataset.paused === '1') {
      resume(iframe);
    } else {
      pause(iframe);
    }
  };

  const teardownObserver = () => {
    if (observer) observer.disconnect();
    observer = null;
  };

  const teardownScrollListener = () => {
    if (scrollRoot && scrollHandler) {
      scrollRoot.removeEventListener('scroll', scrollHandler);
    }
    scrollRoot = null;
    scrollHandler = null;
  };

  const stop = () => {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    iframe.dataset.autoplayStarted = '';
    iframe.dataset.embedLoaded = '';
    iframe.src = 'about:blank';
    setPaused(iframe, true);
  };

  const cleanup = () => {
    teardownObserver();
    teardownScrollListener();
    stop();
  };

  const isInScrollView = (element, root, threshold = 0.4) => {
    if (!element) return false;
    const targetRect = element.getBoundingClientRect();
    if (!root) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const visibleHeight = Math.max(0, Math.min(targetRect.bottom, viewportHeight) - Math.max(targetRect.top, 0));
      return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
    }

    const rootRect = root.getBoundingClientRect();
    const visibleTop = Math.max(targetRect.top, rootRect.top);
    const visibleBottom = Math.min(targetRect.bottom, rootRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
  };

  const startAutoplay = (iframe) => {
    if (!shouldAutoplayTrailers() || !iframe || iframe.dataset.autoplayStarted === '1') return;
    if (iframe.dataset.paused === '1') {
      loadEmbed(iframe);
      return;
    }
    const autoplaySrc = buildAutoplayEmbedUrl(iframe.dataset.embedSrc);
    if (!autoplaySrc) return;
    iframe.dataset.autoplayStarted = '1';
    iframe.dataset.embedLoaded = '1';
    iframe.removeAttribute('loading');
    iframe.src = autoplaySrc;
    setPaused(iframe, false);
  };

  const setup = (modalContent) => {
    teardownObserver();
    teardownScrollListener();
    const trailerEmbed = document.querySelector('.detail-trailer .trailer-embed');
    const iframe = trailerEmbed?.querySelector('iframe');
    if (!iframe?.dataset.embedSrc) return;

    setPaused(iframe, !shouldAutoplayTrailers());
    const root = modalContent || document.querySelector('#detail-modal .modal-content');
    const activate = () => {
      if (iframe.dataset.paused === '1') {
        loadEmbed(iframe);
      } else if (shouldAutoplayTrailers()) {
        startAutoplay(iframe);
      } else {
        loadEmbed(iframe);
      }
    };

    if (!('IntersectionObserver' in window)) {
      activate();
      return;
    }

    observer = new window.IntersectionObserver((entries, activeObserver) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      activate();
      activeObserver.disconnect();
      observer = null;
      teardownScrollListener();
    }, { root: root || null, threshold: 0.4 });
    observer.observe(trailerEmbed);

    scrollRoot = root || window;
    scrollHandler = () => {
      if (!isInScrollView(trailerEmbed, root || null, 0.35)) return;
      activate();
      teardownObserver();
      teardownScrollListener();
    };
    scrollRoot.addEventListener('scroll', scrollHandler, { passive: true });
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(scrollHandler);
    }
  };

  const render = (anime) => {
    if (!anime?.trailer) return '';
    const { url, embedUrl } = buildTrailerUrls(anime.trailer);
    if (!url && !embedUrl) return '';

    const allowEmbed = shouldEmbedTrailers();
    const showEmbed = Boolean(allowEmbed && embedUrl);
    const safeTitle = escapeAttr(anime.title ? `Trailer for ${anime.title}` : 'Anime trailer');
    const safeUrl = escapeAttr(url);
    const safeEmbedUrl = escapeAttr(embedUrl);

    return `
      <div class="detail-trailer" id="detail-trailer">
        <div class="detail-section-header">
          <h3>Trailer</h3>
          <div class="trailer-controls">
            ${showEmbed ? `
              <button class="trailer-control-btn" id="trailer-toggle" type="button" data-action="toggle-trailer" aria-pressed="false" aria-label="Pause trailer" title="Pause trailer">
                <span class="trailer-control-label">Pause</span>
              </button>
            ` : ''}
            ${url ? `<a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="strict-origin-when-cross-origin">Watch on YouTube</a>` : ''}
          </div>
        </div>
        ${showEmbed
        ? `<div class="trailer-embed">
              <iframe
                src="about:blank"
                data-embed-src="${safeEmbedUrl}"
                title="${safeTitle}"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>`
        : `<div class="trailer-fallback">
              ${allowEmbed ? '' : '<p class="trailer-note">Data Saver is on, so the embedded trailer is hidden.</p>'}
              ${url ? `<a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer" referrerpolicy="strict-origin-when-cross-origin">Watch on YouTube</a>` : ''}
            </div>`
      }
      </div>
    `;
  };

  const refresh = ({ currentAnimeId, animeData = [] } = {}) => {
    if (!currentAnimeId) return;
    const anime = animeData.find(item => item.id === currentAnimeId);
    if (!anime) return;

    cleanup();
    const markup = render(anime);
    const current = document.getElementById('detail-trailer');
    const reviewsSection = document.getElementById('community-reviews-section');
    if (!markup) {
      current?.remove();
      return;
    }
    if (current) {
      replaceOuterHTML(current, markup);
    } else if (reviewsSection) {
      insertHTML(reviewsSection, 'beforebegin', markup);
    }
    setup(document.querySelector('#detail-modal .modal-content'));
  };

  return { cleanup, refresh, render, setup, toggle };
};

export { createDetailMedia };

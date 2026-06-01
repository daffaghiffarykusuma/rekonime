// @ts-nocheck
import {
  insertHTML,
  replaceOuterHTML
} from './security/trusted-types.js';

const createDetailMediaAdapter = (app) => {
  const stop = () => {
    app.stopTrailerPlayback();
    app.teardownTrailerObserver();
  };

  const cleanup = () => {
    if (app.trailerCleanup) {
      app.trailerCleanup();
      app.trailerCleanup = null;
      return;
    }
    app.stopTrailerPlayback();
    app.teardownTrailerObserver();
    app.teardownTrailerScrollListener();
  };

  const setup = (modalContent) => {
    app.setupTrailerAutoplay(modalContent);
  };

  const refresh = ({ currentAnimeId, animeData = [] } = {}) => {
    if (!currentAnimeId) return;
    const anime = animeData.find(item => item.id === currentAnimeId);
    if (!anime) return;

    app.stopTrailerPlayback();
    app.teardownTrailerObserver();
    app.teardownTrailerScrollListener();

    const markup = app.renderTrailerSection(anime);
    const current = document.getElementById('detail-trailer');
    const reviewsSection = document.getElementById('community-reviews-section');

    if (!markup) {
      if (current) current.remove();
      return;
    }

    if (current) {
      replaceOuterHTML(current, markup);
    } else if (reviewsSection) {
      insertHTML(reviewsSection, 'beforebegin', markup);
    }

    const modalContent = document.querySelector('#detail-modal .modal-content');
    app.setupTrailerAutoplay(modalContent);
  };

  return {
    cleanup,
    refresh,
    setup,
    stop
  };
};

export { createDetailMediaAdapter };

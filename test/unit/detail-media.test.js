import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailMediaAdapter } from '../../js/detail-media.ts';
import { setupDom } from '../helpers/dom.js';

const createAppHarness = (overrides = {}) => {
  const calls = [];
  const app = {
    trailerCleanup: null,
    stopTrailerPlayback: () => calls.push(['stopTrailerPlayback']),
    teardownTrailerObserver: () => calls.push(['teardownTrailerObserver']),
    teardownTrailerScrollListener: () => calls.push(['teardownTrailerScrollListener']),
    renderTrailerSection: () => '',
    setupTrailerAutoplay: (...args) => calls.push(['setupTrailerAutoplay', ...args]),
    ...overrides
  };
  return { app, calls, media: createDetailMediaAdapter(app) };
};

test('Detail Media refresh replaces the trailer section and restarts autoplay setup', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <section id="detail-trailer">Old</section>
    <section id="community-reviews-section"></section>
  `);
  const { calls, media } = createAppHarness({
    renderTrailerSection: () => '<section id="detail-trailer">New</section>'
  });

  media.refresh({
    currentAnimeId: 'show-1',
    animeData: [{ id: 'show-1', title: 'Show One' }]
  });

  assert.equal(document.getElementById('detail-trailer').textContent, 'New');
  assert.equal(calls.some(([name]) => name === 'stopTrailerPlayback'), true);
  assert.equal(calls.some(([name]) => name === 'setupTrailerAutoplay'), true);
});

test('Detail Media cleanup prefers registered cleanup callback', () => {
  const { app, calls, media } = createAppHarness({
    trailerCleanup: () => calls.push(['registeredCleanup'])
  });

  media.cleanup();

  assert.equal(app.trailerCleanup, null);
  assert.deepEqual(calls, [['registeredCleanup']]);
});

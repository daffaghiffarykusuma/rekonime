import test from 'node:test';
import assert from 'node:assert/strict';
import { createDetailMedia } from '../../js/detail-media.ts';
import { setupDom } from '../helpers/dom.js';

const createMedia = ({ embed = true, autoplay = false } = {}) => createDetailMedia({
  escapeAttr: (value) => String(value ?? '').replaceAll('"', '&quot;'),
  shouldEmbedTrailers: () => embed,
  shouldAutoplayTrailers: () => autoplay
});

const trailer = {
  id: 'abc123',
  url: 'https://www.youtube.com/watch?v=abc123',
  embedUrl: 'https://www.youtube.com/embed/abc123'
};

test('Detail Media renders and refreshes the current trailer', () => {
  setupDom(`
    <div id="detail-modal"><div class="modal-content"></div></div>
    <section id="detail-trailer">Old</section>
    <section id="community-reviews-section"></section>
  `);
  const media = createMedia();

  media.refresh({
    currentAnimeId: 'show-1',
    animeData: [{ id: 'show-1', title: 'Show One', trailer }]
  });

  const iframe = document.querySelector('#detail-trailer iframe');
  assert.equal(iframe?.dataset.embedSrc, 'https://www.youtube.com/embed/abc123');
  assert.equal(iframe?.dataset.paused, '1');
  assert.match(document.getElementById('detail-trailer').textContent, /Watch on YouTube/);
});

test('Detail Media renders the Data Saver fallback without an iframe', () => {
  setupDom();
  const markup = createMedia({ embed: false }).render({
    title: 'Show One',
    trailer
  });

  assert.doesNotMatch(markup, /<iframe/);
  assert.match(markup, /Data Saver is on/);
  assert.match(markup, /https:\/\/www\.youtube\.com\/watch\?v=abc123/);
});

test('Detail Media sends player commands only to the trusted trailer origin', () => {
  setupDom(`
    <div class="detail-trailer">
      <button id="trailer-toggle"><span class="trailer-control-label"></span></button>
      <iframe data-embed-src="https://www.youtube-nocookie.com/embed/abc123"></iframe>
    </div>
  `, { url: 'https://example.com/' });
  const iframe = document.querySelector('iframe');
  let targetOrigin = '';
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { postMessage: (_payload, origin) => { targetOrigin = origin; } }
  });

  createMedia().toggle();

  assert.equal(targetOrigin, 'https://www.youtube-nocookie.com');
  assert.equal(iframe.dataset.paused, '1');
  assert.match(iframe.src, /enablejsapi=1/);
});

test('Detail Media refuses player commands for an untrusted trailer origin', () => {
  setupDom(`
    <div class="detail-trailer">
      <iframe data-embed-src="https://evil.example/embed/abc123"></iframe>
    </div>
  `, { url: 'https://example.com/' });
  const iframe = document.querySelector('iframe');
  let called = false;
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { postMessage: () => { called = true; } }
  });

  createMedia().toggle();

  assert.equal(called, false);
});

test('Detail Media cleanup stops playback', () => {
  setupDom(`
    <div class="detail-trailer">
      <button id="trailer-toggle"><span class="trailer-control-label"></span></button>
      <iframe src="https://www.youtube.com/embed/abc123" data-embed-src="https://www.youtube.com/embed/abc123"></iframe>
    </div>
  `);
  const iframe = document.querySelector('iframe');

  createMedia().cleanup();

  assert.equal(iframe.getAttribute('src'), 'about:blank');
  assert.equal(iframe.dataset.paused, '1');
});

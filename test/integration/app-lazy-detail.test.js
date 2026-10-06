import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';
import { setupDom } from '../helpers/dom.js';

const createApp = () => {
  setupDom('<dialog id="detail-modal"><button id="close-detail">Close</button><div id="detail-content"></div></dialog>');
  return Object.assign(Object.create(App), {
    detailExperience: null, detailExperiencePromise: null, runtimeCapabilities: null,
    detailOpenRequestId: 0, currentAnimeId: null,
    updateUrlForAnime() {}, updateMetaForFilters() {}, getLogger: () => ({ warn() {} })
  });
};

test('closing a detail while its module loads does not reopen the dialog', async () => {
  const app = createApp();
  let resolve;
  const calls = [];
  app.loadDetailExperience = () => new Promise(done => { resolve = done; });
  const opened = app.showAnimeDetail('one');
  assert.equal(document.getElementById('detail-modal').hasAttribute('open'), true);
  assert.match(document.getElementById('detail-content').textContent, /Loading details/);
  app.closeDetailModal();
  resolve({ open: id => calls.push(id) });
  await opened;
  assert.deepEqual(calls, []);
  assert.equal(document.getElementById('detail-modal').hasAttribute('open'), false);
});

test('only the latest requested title opens after the shared module loads', async () => {
  const app = createApp();
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const calls = [];
  app.loadDetailExperience = () => pending;
  const first = app.showAnimeDetail('one');
  const second = app.showAnimeDetail('two');
  resolve({ open: id => calls.push(id) });
  await Promise.all([first, second]);
  assert.deepEqual(calls, ['two']);
});

test('detail module failures show a retry and a later request can succeed', async () => {
  const app = createApp();
  app.loadDetailExperience = async () => { throw new Error('Offline'); };
  await app.showAnimeDetail('one');
  assert.equal(document.querySelector('[data-action="open-anime"]').dataset.animeId, 'one');
  assert.match(document.querySelector('[role="alert"]').textContent, /could not load/);
  const calls = [];
  app.loadDetailExperience = async () => ({ open: id => calls.push(id) });
  await app.showAnimeDetail('one');
  assert.deepEqual(calls, ['one']);
});

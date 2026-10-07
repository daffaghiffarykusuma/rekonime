import test from 'node:test';
import assert from 'node:assert/strict';
import { App } from '../../src/app/app.ts';

test('App Shell delegates all detail session commands and reads the owned title', async () => {
  const calls = [];
  let current = null;
  const detailExperience = {
    open: async (id, options) => { current = id; calls.push(['open', id, options]); },
    close: options => { current = null; calls.push(['close', options]); },
    syncWithUrl: options => calls.push(['sync', options]),
    getCurrentAnimeId: () => current
  };
  const app = Object.assign(Object.create(App), { detailExperience });
  await app.showAnimeDetail('one', { deepLink: true, updateUrl: false });
  assert.equal(app.currentAnimeId, 'one');
  app.syncModalWithUrl({ updateUrl: false });
  app.closeDetailModal();
  assert.equal(app.currentAnimeId, null);
  assert.deepEqual(calls, [
    ['open', 'one', { deepLink: true, updateUrl: false }],
    ['sync', { updateUrl: false }], ['close', {}]
  ]);
  assert.throws(() => { app.currentAnimeId = 'other'; }, TypeError);
});

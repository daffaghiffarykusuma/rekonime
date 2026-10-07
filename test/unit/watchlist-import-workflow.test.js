import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatchlistImportWorkflow } from '../../src/features/watchlist/watchlist-import-workflow.ts';
import * as tools from '../../src/features/watchlist/mal-watchlist-import.ts';
import { setupDom } from '../helpers/dom.js';

const xml = (progress = 3) => `<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>One</series_title><my_status>Watching</my_status><my_watched_episodes>${progress}</my_watched_episodes></anime></myanimelist>`;
const file = (name = 'list.xml', progress = 3) => ({ name, text: async () => xml(progress) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const catalog = [{ id: 'one', malId: 1, title: 'One', episodeCount: 12 }];
const harness = (overrides = {}) => {
  setupDom();
  const updates = [], applied = [], effects = [], refreshes = [];
  const workflow = createWatchlistImportWorkflow({
    loadTools: async () => tools,
    getFullCatalog: async () => catalog,
    getEntries: () => [],
    applyPlan: plan => { applied.push(plan); return { changed: true }; },
    applyEffects: result => effects.push(result),
    refreshRecommendations: () => refreshes.push(true),
    onUpdate: update => updates.push(update),
    ...overrides
  });
  return { workflow, updates, applied, effects, refreshes };
};

for (const phase of ['tools', 'file', 'catalog']) {
  for (const action of ['cancel', 'replace']) {
    test(`${action} invalidates a pending ${phase} phase`, async () => {
      const waiting = deferred(), entered = deferred();
      let reads = 0, catalogCalls = 0, loads = 0;
      const { workflow, applied } = harness({
        loadTools: () => { loads++; if (phase === 'tools') { entered.resolve(); return waiting.promise; } return Promise.resolve(tools); },
        getFullCatalog: () => { catalogCalls++; if (phase === 'catalog' && catalogCalls === 1) { entered.resolve(); return waiting.promise; } return Promise.resolve(catalog); }
      });
      const pending = workflow.review({ name: 'old.xml', text: () => {
        reads++;
        if (phase === 'file') { entered.resolve(); return waiting.promise; }
        return Promise.resolve(xml(3));
      } });
      await entered.promise;
      const replacement = action === 'replace' ? workflow.review(file('new.xml', 7)) : workflow.cancel();
      waiting.resolve(phase === 'tools' ? tools : phase === 'file' ? xml(3) : catalog);
      await Promise.all([pending, replacement]);
      assert.equal(applied.length, 0);
      assert.equal(loads, 1, 'the loader is shared and cached across sessions');
      if (phase === 'tools') assert.equal(reads, 0, 'obsolete files are never read');
      if (action === 'cancel') assert.equal(workflow.getView().stage, 'choose');
      else {
        assert.equal(workflow.getView().fileName, 'new.xml');
        assert.equal(workflow.getView().stage, 'review');
        workflow.apply();
        assert.equal(applied[0].proposedEntries[0].progress, 7);
      }
    });
  }
}

test('obsolete failures cannot overwrite a replacement review', async () => {
  const waiting = deferred(), entered = deferred();
  const { workflow } = harness();
  const first = workflow.review({ name: 'old.xml', text: () => { entered.resolve(); return waiting.promise; } });
  await entered.promise;
  await workflow.review(file('new.xml'));
  waiting.reject(new Error('old file failed'));
  await first;
  assert.equal(workflow.getView().stage, 'review');
  assert.equal(workflow.getView().error, '');
});

for (const phase of ['tools', 'catalog']) {
  test(`${phase} failure retains the file and retries review without writes`, async () => {
    let attempts = 0, reads = 0;
    const { workflow, applied } = harness(phase === 'tools' ? {
      loadTools: async () => { if (++attempts === 1) throw new Error('offline'); return tools; }
    } : {
      getFullCatalog: async () => ++attempts === 1 ? null : catalog
    });
    await workflow.review({ name: 'retry.xml', text: async () => { reads++; return xml(); } });
    assert.equal(workflow.getView().stage, 'error');
    assert.equal(workflow.getView().retry, 'review');
    assert.equal(workflow.getView().fileName, 'retry.xml');
    await workflow.retry();
    assert.equal(workflow.getView().stage, 'review');
    assert.equal(reads, phase === 'tools' ? 1 : 2);
    assert.equal(applied.length, 0);
  });
}

test('file-read retry requests file selection; malformed XML stays an error without writes', async () => {
  let reads = 0;
  const { workflow, updates, applied } = harness();
  await workflow.review({ name: 'unreadable.xml', text: async () => { reads++; throw new Error('denied'); } });
  assert.equal(workflow.getView().retry, 'file');
  await workflow.retry();
  assert.deepEqual(updates.at(-1), { focus: 'file' });
  assert.equal(reads, 1);
  await workflow.review({ name: 'bad.xml', text: async () => '<wrong/>' });
  assert.equal(workflow.getView().stage, 'error');
  assert.match(workflow.getView().error, /XML export cannot be imported/);
  assert.equal(applied.length, 0);
});

test('choices retain detached review evidence and presentation cannot mutate the applicable plan', async () => {
  const entries = [{ id: 'one', status: 'watching', progress: 1, updatedAt: 100 }];
  const { workflow, applied } = harness({ getEntries: () => entries });
  await workflow.review(file());
  const view = workflow.getView();
  assert.equal('file' in view, false);
  assert.equal('plan' in view, false);
  assert.equal('proposedEntries' in view.review, false);
  view.review.conflicts[0].incoming.progress = 99;
  view.review.summary.updates = 99;
  entries[0].progress = 9;
  workflow.choose('one', true);
  assert.equal(workflow.getView().review.conflicts[0].local.progress, 1);
  assert.equal(workflow.getView().review.conflicts[0].incoming.progress, 3);
  assert.equal(workflow.getView().review.summary.updates, 1);
  workflow.apply();
  assert.equal(applied[0].proposedEntries[0].progress, 3);
  assert.equal(JSON.parse(applied[0].fingerprint)[0].progress, 1);
});

test('stale plans require a new review; failed storage keeps review choices for another apply', async () => {
  let reason = 'storage-failed';
  const entries = [{ id: 'one', status: 'watching', progress: 1, updatedAt: 100 }];
  const { workflow, effects } = harness({
    getEntries: () => entries,
    applyPlan: () => ({ changed: false, compatibilityResult: { status: 'rejected', reason } })
  });
  await workflow.review(file());
  workflow.choose('one', true);
  workflow.apply();
  assert.equal(workflow.getView().stage, 'review');
  assert.equal(workflow.getView().review.conflicts[0].useMal, true);
  reason = 'stale-plan';
  workflow.apply();
  assert.equal(workflow.getView().stage, 'error');
  assert.equal(workflow.getView().retry, 'review');
  assert.match(workflow.getView().error, /Watchlist changed/);
  entries[0].progress = 2;
  await workflow.retry();
  assert.equal(workflow.getView().review.conflicts[0].local.progress, 2);
  assert.equal(workflow.getView().review.conflicts[0].useMal, false);
  assert.equal(effects.length, 0);
});

test('committed state is visible during effects; retry never commits twice', async () => {
  let commits = 0, refreshes = 0;
  const { workflow, updates } = harness({
    applyPlan: () => { commits++; return { changed: true }; },
    applyEffects: () => { assert.equal(workflow.getView().stage, 'success'); throw new Error('derivation failed'); },
    refreshRecommendations: () => { if (++refreshes === 1) throw new Error('still failed'); }
  });
  await workflow.review(file());
  workflow.apply();
  assert.equal(workflow.getView().stage, 'partial-success');
  assert.equal(workflow.getView().retry, 'recommendations');
  workflow.apply();
  await workflow.retry();
  assert.equal(workflow.getView().stage, 'partial-success');
  await workflow.retry();
  assert.equal(workflow.getView().stage, 'success');
  await workflow.retry();
  assert.equal(commits, 1);
  assert.equal(refreshes, 2);
  assert.match(updates.at(-1).announcement, /recommendations refreshed/);
});

test('no-change and cancelled imports cannot trigger downstream effects or repeat an apply', async () => {
  let commits = 0;
  const { workflow, effects, refreshes } = harness({ applyPlan: () => { commits++; return { changed: false }; } });
  workflow.apply();
  await workflow.review(file());
  workflow.cancel();
  workflow.apply();
  await workflow.retry();
  assert.equal(commits, 0);
  await workflow.review(file());
  workflow.apply();
  workflow.apply();
  await workflow.retry();
  assert.equal(workflow.getView().noChanges, true);
  assert.equal(commits, 1);
  assert.deepEqual(effects, []);
  assert.deepEqual(refreshes, []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseMalWatchlistXml,
  planMalWatchlistImport, validateMalImportPlan
} from '../../src/features/watchlist/mal-watchlist-import.ts';
import { buildPrivacySafeMalExport } from '../helpers/mal-watchlist-fixture.js';

test('privacy-safe fixture preserves the 415 row and 339 exact-match regression', () => {
  const fullCatalog = JSON.parse(readFileSync('data/anime.full.json', 'utf8')).anime;
  const xml = buildPrivacySafeMalExport(fullCatalog);

  const plan = planMalWatchlistImport({
    parseResult: parseMalWatchlistXml(xml),
    fullCatalog,
    currentEntries: []
  });

  assert.deepEqual(plan.summary, {
    sourceRows: 415,
    valid: 415,
    invalid: 0,
    updates: 0,
    conflicts: 0,
    unchanged: 0,
    matched: 339,
    creates: 339,
    skipped: 76,
    unmatched: 76
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.proposedEntries.length, 339);
  assert.ok(plan.proposedEntries.every(entry => entry.snapshot?.malId));
  assert.ok(plan.proposedEntries.every(entry => entry.updatedAt === 'apply-time'));
  assert.ok(plan.unmatchedRows.every(row => row.reason === 'catalog-miss'));
});

test('MAL XML parsing uses the Trusted Types policy when Chrome requires it', () => {
  const runtime = globalThis as any;
  const windowRef = runtime.window;
  const originalParser = runtime.DOMParser;
  const NativeParser = windowRef.DOMParser;
  const originalTrustedTypes = windowRef.trustedTypes;
  Object.defineProperty(windowRef, 'trustedTypes', {
    configurable: true,
    value: {
      createPolicy: (_name: string, rules: any) => ({
        createHTML: (value: unknown) => ({ toString: () => rules.createHTML(value) })
      })
    }
  });
  runtime.DOMParser = class {
    parseFromString(source: unknown, type: string) {
      assert.equal(typeof source, 'object');
      return new NativeParser().parseFromString(String(source), type);
    }
  };

  try {
    assert.equal(parseMalWatchlistXml('<myanimelist><anime><series_animedb_id>1</series_animedb_id><series_title>One</series_title><my_watched_episodes>0</my_watched_episodes><my_status>Plan to Watch</my_status></anime></myanimelist>').ok, true);
  } finally {
    if (originalParser) runtime.DOMParser = originalParser;
    else delete runtime.DOMParser;
    Object.defineProperty(windowRef, 'trustedTypes', { configurable: true, value: originalTrustedTypes });
  }
});

const row = (id = '1', status = 'Watching', progress = '3', extra = '') => `<anime><series_animedb_id>${id}</series_animedb_id><series_title>Title ${id}</series_title><series_episodes>12</series_episodes><my_watched_episodes>${progress}</my_watched_episodes><my_status>${status}</my_status>${extra}</anime>`;
const xml = (...rows: string[]) => `<myanimelist>${rows.join('')}</myanimelist>`;
const catalog = [{ id: 'one', malId: 1, title: 'Title 1', cover: '', episodeCount: 12 }];

test('fatal XML errors never produce an applicable plan', () => {
  for (const source of ['', '<!DOCTYPE myanimelist><myanimelist/>', '<myanimelist>', '<other/>', '<myanimelist/>', xml(row(), row())]) {
    const parsed = parseMalWatchlistXml(source);
    assert.equal(parsed.ok, false);
    assert.equal(planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog }).ok, false);
  }
});

test('row errors and unmatched IDs preserve valid rows, exact matches, and truthful counts', () => {
  const parsed = parseMalWatchlistXml(xml(row(), row('2', 'Mystery'), row('3', 'Watching', '-1'), row('4').replace('<series_episodes>12', '<series_episodes>-2'), row('5').replace('<my_status>', '<my_status>Watching</my_status><my_status>'), row('999')));
  assert.equal(parsed.ok, true);
  const plan = planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.summary, { sourceRows: 6, valid: 2, matched: 1, creates: 1, updates: 0, conflicts: 0, unchanged: 0, invalid: 4, unmatched: 1, skipped: 5 });
  assert.equal(plan.unmatchedRows[0]!.malId, 999);
  assert.equal(validateMalImportPlan({ ...plan, summary: { ...plan.summary, creates: 2 } }), false);
  assert.equal(planMalWatchlistImport({ parseResult: parsed, fullCatalog: [] }).errors[0], 'catalog-unavailable');
});

test('merge defaults to local evidence, overrides only selected progress, and repeats without timestamp changes', () => {
  const local = { id: 'one', status: 'watching' as const, progress: 2, updatedAt: 1000, loved: true, lovedAt: 900, startedAt: 800, snapshot: { id: 'one', title: 'Saved title', cover: 'saved.jpg' } };
  const parsed = parseMalWatchlistXml(xml(row('1', 'Completed', '99', '<my_start_date>2026-01-01</my_start_date><my_finish_date>2026-09-01</my_finish_date>')));
  const kept = planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog, currentEntries: [local] });
  assert.equal(kept.summary.conflicts, 1);
  assert.equal(kept.summary.updates, 0);
  assert.equal(kept.conflicts[0]!.useMal, false);
  const override = planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog, currentEntries: [local], choices: { one: true } });
  const updated = override.proposedEntries[0]!;
  assert.equal(updated.progress, 12);
  assert.equal(updated.startedAt, 800);
  assert.equal(updated.completedAt, Date.parse('2026-09-01T00:00:00Z'));
  assert.equal(updated.lovedAt, 900);
  assert.deepEqual(updated.snapshot, local.snapshot);
  const after = { ...updated, updatedAt: 2000 };
  const repeat = planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog, currentEntries: [after] });
  assert.equal(repeat.summary.unchanged, 1);
  assert.deepEqual(repeat.proposedEntries, []);
  assert.ok(override.warnings.some(issue => issue.reason === 'completed-progress-normalized'));
});

test('all statuses map, invalid dates remain unknown, and inference dates are never invented', () => {
  for (const [incoming, expected] of [['Plan to Watch', 'planned'], ['Watching', 'watching'], ['On-Hold', 'watching'], ['Completed', 'completed'], ['Dropped', 'dropped']]) {
    const parsed = parseMalWatchlistXml(xml(row('1', incoming, '3', '<my_start_date>2026-02-30</my_start_date><my_finish_date>0000-00-00</my_finish_date>')));
    const plan = planMalWatchlistImport({ parseResult: parsed, fullCatalog: catalog });
    assert.equal(plan.proposedEntries[0]!.status, expected);
    assert.equal(plan.proposedEntries[0]!.startedAt, undefined);
    assert.equal(plan.proposedEntries[0]!.completedAt, undefined);
    assert.ok(plan.warnings.some(issue => issue.reason === 'unknown-my_start_date'));
  }
});

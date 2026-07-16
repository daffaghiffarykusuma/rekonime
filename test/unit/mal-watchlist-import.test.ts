import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  parseMalWatchlistXml,
  planMalWatchlistImport
} from '../../js/mal-watchlist-import.ts';
import { buildPrivacySafeMalExport } from '../helpers/mal-watchlist-fixture.js';

const suppliedExport = 'plans/animelist_1784001772_-_10574948.xml';

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
    matched: 339,
    creates: 339,
    skipped: 76,
    unmatched: 76
  });
});

test('supplied MAL export plans exact full-catalog Watchlist creates', {
  skip: !existsSync(suppliedExport)
}, () => {
  const xml = readFileSync(suppliedExport, 'utf8');
  const fullCatalog = JSON.parse(readFileSync('data/anime.full.json', 'utf8')).anime;

  const parsed = parseMalWatchlistXml(xml);
  const plan = planMalWatchlistImport({
    parseResult: parsed,
    fullCatalog,
    currentEntries: []
  });

  assert.equal(parsed.ok, true);
  assert.equal(parsed.rows.length, 415);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.summary, {
    sourceRows: 415,
    matched: 339,
    creates: 339,
    skipped: 76,
    unmatched: 76
  });
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

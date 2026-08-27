import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseMalWatchlistXml,
  planMalWatchlistImport
} from '../../js/mal-watchlist-import.ts';
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

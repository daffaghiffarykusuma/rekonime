import { buildAnimeSnapshot } from './watchlist-state.js';
import { toTrustedHTML } from './security/trusted-types.js';
import type { Snapshot, WatchStatus, WatchlistEntry } from './contracts/watchlist-lifecycle.ts';

type ParsedMalRow = {
  row: number;
  malId: number;
  title: string;
  status: WatchStatus;
  watchedEpisodes: number;
};

type MalParseResult = {
  ok: boolean;
  rows: ParsedMalRow[];
  errors: string[];
};

type ProposedWatchlistEntry = Omit<WatchlistEntry, 'updatedAt' | 'startedAt' | 'completedAt'> & {
  updatedAt: number | 'apply-time';
  startedAt?: number | 'apply-time';
  completedAt?: number | 'apply-time';
};

type MalImportPlan = {
  ok: boolean;
  catalogScope: 'full';
  errors: string[];
  proposedEntries: ProposedWatchlistEntry[];
  unmatchedRows: Array<{
    row: number;
    malId: number;
    sourceTitle: string;
    reason: 'catalog-miss';
  }>;
  summary: {
    sourceRows: number;
    matched: number;
    creates: number;
    skipped: number;
    unmatched: number;
  };
};

const statusMap: Record<string, WatchStatus> = {
  'Plan to Watch': 'planned',
  Watching: 'watching',
  'On-Hold': 'watching',
  Completed: 'completed',
  Dropped: 'dropped'
};

const parseMalWatchlistXml = (text: string): MalParseResult => {
  if (!String(text || '').trim()) return { ok: false, rows: [], errors: ['empty-input'] };
  const runtime = globalThis as any;
  const Parser = runtime.DOMParser || runtime.window?.DOMParser;
  if (!Parser) return { ok: false, rows: [], errors: ['xml-parser-unavailable'] };

  const document = new Parser().parseFromString(toTrustedHTML(text), 'application/xml');
  if (document.querySelector('parsererror') || document.documentElement?.localName !== 'myanimelist') {
    return { ok: false, rows: [], errors: ['malformed-xml'] };
  }

  const rows = (Array.from(document.documentElement.children) as any[])
    .filter((element) => element.localName === 'anime')
    .map((element, index) => {
      const value = (name: string) => element.querySelector(name)?.textContent?.trim() || '';
      const sourceStatus = value('my_status');
      return {
        row: index + 1,
        malId: Number(value('series_animedb_id')),
        title: value('series_title'),
        status: statusMap[sourceStatus],
        watchedEpisodes: Math.max(0, Math.floor(Number(value('my_watched_episodes')) || 0))
      };
    })
    .filter((row): row is ParsedMalRow => Number.isInteger(row.malId) && row.malId > 0 && Boolean(row.title) && Boolean(row.status));

  return rows.length > 0
    ? { ok: true, rows, errors: [] }
    : { ok: false, rows: [], errors: ['no-anime-rows'] };
};

const getEpisodeCount = (anime: Record<string, unknown>) => {
  const stats = anime.stats as { episodeCount?: unknown } | undefined;
  const count = Number(stats?.episodeCount ?? anime.episodeCount ?? anime.episodesTotal);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : null;
};

const planMalWatchlistImport = ({
  parseResult,
  fullCatalog,
  currentEntries = []
}: {
  parseResult: MalParseResult;
  fullCatalog: Array<Record<string, unknown>>;
  currentEntries?: WatchlistEntry[];
}): MalImportPlan => {
  const emptyPlan = (errors: string[]): MalImportPlan => ({
    ok: false,
    catalogScope: 'full',
    errors,
    proposedEntries: [],
    unmatchedRows: [],
    summary: { sourceRows: parseResult.rows.length, matched: 0, creates: 0, skipped: parseResult.rows.length, unmatched: 0 }
  });
  if (!parseResult.ok) return emptyPlan(parseResult.errors);
  if (!Array.isArray(fullCatalog)) return emptyPlan(['catalog-unavailable']);

  const catalogByMalId = new Map<number, Record<string, unknown>>();
  fullCatalog.forEach((anime) => {
    const malId = Number(anime?.malId);
    if (Number.isInteger(malId) && malId > 0) catalogByMalId.set(malId, anime);
  });
  const currentIds = new Set(currentEntries.map((entry) => entry.id));
  const proposedEntries: ProposedWatchlistEntry[] = [];
  const unmatchedRows: MalImportPlan['unmatchedRows'] = [];
  let matched = 0;

  parseResult.rows.forEach((row) => {
    const anime = catalogByMalId.get(row.malId);
    if (!anime) {
      unmatchedRows.push({ row: row.row, malId: row.malId, sourceTitle: row.title, reason: 'catalog-miss' });
      return;
    }
    matched += 1;
    const id = String(anime.id || '').trim();
    if (!id || currentIds.has(id)) return;
    const episodeCount = getEpisodeCount(anime);
    const progress = episodeCount ? Math.min(row.watchedEpisodes, episodeCount) : row.watchedEpisodes;
    const snapshot = buildAnimeSnapshot(anime, { requireCover: false }) as Snapshot | null;
    if (!snapshot) return;
    proposedEntries.push({
      id,
      status: row.status,
      progress,
      updatedAt: 'apply-time',
      ...(row.status !== 'planned' ? { startedAt: 'apply-time' as const } : {}),
      ...(row.status === 'completed' ? { completedAt: 'apply-time' as const } : {}),
      snapshot
    });
  });

  return {
    ok: true,
    catalogScope: 'full',
    errors: [],
    proposedEntries,
    unmatchedRows,
    summary: {
      sourceRows: parseResult.rows.length,
      matched,
      creates: proposedEntries.length,
      skipped: parseResult.rows.length - proposedEntries.length,
      unmatched: unmatchedRows.length
    }
  };
};

export {
  parseMalWatchlistXml,
  planMalWatchlistImport
};

export type {
  MalImportPlan,
  MalParseResult,
  ParsedMalRow,
  ProposedWatchlistEntry
};

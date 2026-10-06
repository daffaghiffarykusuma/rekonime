import { CatalogPayload } from '../catalog/catalog-payload.ts';
import { buildAnimeSnapshot } from './watchlist-state.js';
import { toTrustedHTML } from '../../shared/security/trusted-types.js';
import { fingerprintWatchlist, validateMalImportPlan } from './mal-import-plan.ts';
import type { MalImportPlan, MalParseResult, ParsedMalRow, ProposedWatchlistEntry } from './mal-import-plan.ts';
import type { Snapshot, WatchStatus, WatchlistEntry } from './contracts/watchlist-lifecycle.ts';

const statusMap: Record<string, WatchStatus> = {
  'Plan to Watch': 'planned', Watching: 'watching', 'On-Hold': 'watching',
  Completed: 'completed', Dropped: 'dropped'
};
const integer = (value: string) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value === '0000-00-00') return undefined;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return timestamp > 0 && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : undefined;
};

const parseMalWatchlistXml = (text: string): MalParseResult => {
  const result: MalParseResult = { ok: false, sourceRows: 0, rows: [], errors: [], invalidRows: [], warnings: [] };
  const reject = (reason: string) => ({ ...result, errors: [reason] });
  if (!String(text || '').trim()) return reject('empty-input');
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(text)) return reject('forbidden-declaration');
  const runtime = globalThis as any;
  const Parser = runtime.DOMParser || runtime.window?.DOMParser;
  if (!Parser) return reject('xml-parser-unavailable');
  let document: any;
  try { document = new Parser().parseFromString(toTrustedHTML(text), 'application/xml'); }
  catch { return reject('malformed-xml'); }
  if (document.querySelector('parsererror')) return reject('malformed-xml');
  if (document.documentElement?.localName !== 'myanimelist') return reject('unexpected-root');
  const elements = (Array.from(document.documentElement.children) as any[]).filter(element => element.localName === 'anime');
  result.sourceRows = elements.length;
  if (!elements.length) return reject('no-anime-rows');
  const seen = new Set<number>();
  for (const [index, element] of elements.entries()) {
    const row = index + 1;
    const children = Array.from(element.children) as any[];
    const fields = (name: string) => children.filter(child => child.localName === name);
    const value = (name: string) => fields(name)[0]?.textContent?.trim() || '';
    const sourceTitle = value('series_title');
    const required = ['series_animedb_id', 'series_title', 'my_status', 'my_watched_episodes'];
    const badField = required.find(name => fields(name).length !== 1 || !value(name));
    const malId = Number(value('series_animedb_id'));
    if (integer(value('series_animedb_id')) && malId > 0) {
      if (seen.has(malId)) return reject('duplicate-mal-id');
      seen.add(malId);
    }
    const sourceStatus = value('my_status');
    const progress = value('my_watched_episodes');
    const total = value('series_episodes');
    const reason = badField ? `invalid-field:${badField}`
      : !integer(value('series_animedb_id')) || malId <= 0 ? 'invalid-mal-id'
        : !integer(progress) ? 'invalid-progress'
          : fields('series_episodes').length > 1 || (total && !integer(total)) ? 'invalid-episode-total'
            : !Object.hasOwn(statusMap, sourceStatus) ? 'unknown-status' : '';
    if (reason) { result.invalidRows.push({ row, sourceTitle, reason }); continue; }
    const warn = (reason: string) => result.warnings.push({ row, sourceTitle, reason });
    if (sourceStatus === 'On-Hold') warn('on-hold-mapped-to-watching');
    if (!total || Number(total) === 0) warn('unknown-episode-total');
    const dates: { startedAt?: number; completedAt?: number } = {};
    for (const [field, key] of [['my_start_date', 'startedAt'], ['my_finish_date', 'completedAt']] as const) {
      const date = value(field);
      const parsed = fields(field).length <= 1 ? parseDate(date) : undefined;
      if (parsed) dates[key] = parsed;
      else warn(`unknown-${field}`);
    }
    result.rows.push({ row, malId, title: sourceTitle, status: statusMap[sourceStatus] as WatchStatus,
      watchedEpisodes: Number(progress), episodeCount: Number(total) || null, ...dates });
  }
  return { ...result, ok: true };
};

const getEpisodeCount = (anime: Record<string, any>) => CatalogPayload.getEpisodeCount(anime) || null;

const planMalWatchlistImport = ({ parseResult, fullCatalog, currentEntries = [], choices = {} }: {
  parseResult: MalParseResult; fullCatalog: Array<Record<string, any>>;
  currentEntries?: WatchlistEntry[]; choices?: Record<string, boolean>;
}): MalImportPlan => {
  const summary = { sourceRows: parseResult.sourceRows, valid: parseResult.rows.length,
    matched: 0, creates: 0, updates: 0, conflicts: 0, unchanged: 0,
    invalid: parseResult.invalidRows.length, unmatched: 0, skipped: parseResult.sourceRows };
  const plan: MalImportPlan = { ok: false, catalogScope: 'full', errors: [],
    fingerprint: fingerprintWatchlist(currentEntries), proposedEntries: [], conflicts: [],
    invalidRows: [...parseResult.invalidRows], warnings: [...parseResult.warnings], unmatchedRows: [], summary };
  if (!parseResult.ok) return { ...plan, errors: parseResult.errors };
  if (!Array.isArray(fullCatalog) || !fullCatalog.length) return { ...plan, errors: ['catalog-unavailable'] };
  const catalog = new Map(fullCatalog.map(anime => [Number(anime.malId), anime]));
  const current = new Map(currentEntries.map(entry => [entry.id, entry]));
  for (const row of parseResult.rows) {
    const anime = catalog.get(row.malId);
    if (!anime?.id) {
      plan.unmatchedRows.push({ row: row.row, sourceTitle: row.title, malId: row.malId, reason: 'catalog-miss' });
      summary.unmatched += 1; continue;
    }
    summary.matched += 1;
    const total = getEpisodeCount(anime);
    const clamped = total ? Math.min(row.watchedEpisodes, total) : row.watchedEpisodes;
    const progress = row.status === 'completed' && total ? total : clamped;
    const warn = (reason: string) => plan.warnings.push({ row: row.row, sourceTitle: row.title, reason });
    if (progress !== row.watchedEpisodes) warn(row.status === 'completed' ? 'completed-progress-normalized' : 'progress-clamped');
    if (row.title !== anime.title) warn('title-differs-from-catalog');
    const local = current.get(String(anime.id));
    if (local && local.status === row.status && local.progress === progress) { summary.unchanged += 1; continue; }
    if (local) {
      const useMal = choices[local.id] === true;
      plan.conflicts.push({ id: local.id, title: anime.title, local, incoming: { status: row.status, progress }, useMal });
      summary.conflicts += 1;
      if (!useMal) continue;
      summary.updates += 1;
    } else summary.creates += 1;
    const snapshot = local?.snapshot || buildAnimeSnapshot(anime, { requireCover: false }) as Snapshot;
    plan.proposedEntries.push({ ...local, id: String(anime.id), status: row.status, progress, updatedAt: 'apply-time',
      ...(local?.startedAt || row.startedAt ? { startedAt: local?.startedAt || row.startedAt } : {}),
      ...(local?.completedAt || row.completedAt ? { completedAt: local?.completedAt || row.completedAt } : {}), snapshot });
  }
  summary.skipped = summary.sourceRows - summary.creates - summary.updates;
  plan.ok = validateMalImportPlan({ ...plan, ok: true });
  if (!plan.ok) plan.errors = ['invalid-plan'];
  return plan;
};

export { parseMalWatchlistXml, planMalWatchlistImport, fingerprintWatchlist, validateMalImportPlan };
export type { MalImportPlan, MalParseResult, ParsedMalRow, ProposedWatchlistEntry };

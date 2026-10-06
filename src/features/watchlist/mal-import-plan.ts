import type { WatchStatus, WatchlistEntry } from './contracts/watchlist-lifecycle.ts';

type RowIssue = { row: number; sourceTitle: string; reason: string };
type ParsedMalRow = {
  row: number; malId: number; title: string; status: WatchStatus; watchedEpisodes: number;
  episodeCount: number | null; startedAt?: number; completedAt?: number;
};
type MalParseResult = {
  ok: boolean; sourceRows: number; rows: ParsedMalRow[]; errors: string[];
  invalidRows: RowIssue[]; warnings: RowIssue[];
};
type ProposedWatchlistEntry = Omit<WatchlistEntry, 'updatedAt'> & { updatedAt: number | 'apply-time' };
type MalConflict = {
  id: string; title: string; local: WatchlistEntry;
  incoming: { status: WatchStatus; progress: number }; useMal: boolean;
};
type MalImportPlan = {
  ok: boolean; catalogScope: 'full'; errors: string[]; fingerprint: string;
  proposedEntries: ProposedWatchlistEntry[]; conflicts: MalConflict[];
  invalidRows: RowIssue[]; warnings: RowIssue[];
  unmatchedRows: Array<RowIssue & { malId: number }>;
  summary: {
    sourceRows: number; valid: number; matched: number; creates: number; updates: number;
    conflicts: number; unchanged: number; invalid: number; unmatched: number; skipped: number;
  };
};

// Include persisted entry fields so an old review cannot replace newer local evidence.
const stableValue = (value: any): any => Array.isArray(value) ? value.map(stableValue)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])])) : value;
const fingerprintWatchlist = (entries: WatchlistEntry[]) => JSON.stringify(
  [...entries].sort((a, b) => a.id.localeCompare(b.id)).map(stableValue)
);

const validateMalImportPlan = (plan: MalImportPlan) => {
  if (!plan?.ok || plan.catalogScope !== 'full' || typeof plan.fingerprint !== 'string'
    || !Array.isArray(plan.proposedEntries) || !Array.isArray(plan.conflicts)
    || !Array.isArray(plan.invalidRows) || !Array.isArray(plan.unmatchedRows)
    || !Array.isArray(plan.warnings) || !Array.isArray(plan.errors)) return false;
  try { JSON.stringify(plan.proposedEntries); } catch { return false; }
  const s = plan.summary;
  if (!s || !Object.values(s).every(value => Number.isSafeInteger(value) && value >= 0)) return false;
  if (!plan.proposedEntries.every(entry => entry && typeof entry.id === 'string' && entry.id.trim() === entry.id && entry.id
    && ['planned', 'watching', 'completed', 'dropped'].includes(entry.status)
    && Number.isSafeInteger(entry.progress) && entry.progress >= 0 && entry.updatedAt === 'apply-time'
    && ['startedAt', 'completedAt', 'lovedAt'].every(key => (entry as any)[key] === undefined || (Number.isFinite((entry as any)[key]) && (entry as any)[key] > 0))
    && (entry.loved === undefined || typeof entry.loved === 'boolean')
    && entry.snapshot?.id === entry.id && typeof entry.snapshot?.title === 'string' && Boolean(entry.snapshot.title.trim()))) return false;
  if (!plan.conflicts.every(conflict => conflict && typeof conflict.id === 'string' && typeof conflict.useMal === 'boolean'
    && conflict.local?.id === conflict.id && ['planned', 'watching', 'completed', 'dropped'].includes(conflict.incoming?.status)
    && Number.isSafeInteger(conflict.incoming?.progress) && conflict.incoming.progress >= 0)) return false;
  if (new Set(plan.conflicts.map(conflict => conflict.id)).size !== plan.conflicts.length) return false;
  if (!plan.conflicts.filter(conflict => conflict.useMal).every(conflict => plan.proposedEntries.some(entry =>
    entry.id === conflict.id && entry.status === conflict.incoming.status && entry.progress === conflict.incoming.progress))) return false;
  const ids = plan.proposedEntries.map(entry => entry.id);
  return s.sourceRows === s.valid + s.invalid && s.valid === s.matched + s.unmatched
    && s.matched === s.creates + s.conflicts + s.unchanged && s.updates <= s.conflicts
    && s.skipped === s.sourceRows - s.creates - s.updates
    && plan.proposedEntries.length === s.creates + s.updates && new Set(ids).size === ids.length
    && plan.conflicts.length === s.conflicts && plan.conflicts.filter(conflict => conflict.useMal).length === s.updates
    && plan.invalidRows.length === s.invalid && plan.unmatchedRows.length === s.unmatched;
};

export { fingerprintWatchlist, validateMalImportPlan };
export type { MalImportPlan, MalParseResult, ParsedMalRow, ProposedWatchlistEntry };

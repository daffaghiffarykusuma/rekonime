---
ticket: ../tickets/define-watchlist-import-contract.md
resolved_at: 2026-07-14
---

# Resolution: Define the Watchlist Lifecycle import contract

Use one MAL-specific pure planner and one atomic Watchlist Lifecycle batch mutation. The Watchlist payload remains the only durable source of truth for imported status, progress, dates, and Snapshots. Taste Profile inference is derived from the committed Watchlist and refreshed once after a successful mutation; MAL scores are not imported into it.

## Minimum module changes

- Add `js/mal-watchlist-import.ts` for pure `parseMalWatchlistXml` and `planMalWatchlistImport` functions. Use native `DOMParser`; reject `DOCTYPE` or entity declarations before parsing. Do not add a provider interface or dependency.
- Extend `js/contracts/watchlist-lifecycle.ts` with the import result types below, `WatchlistOperation: 'import'`, the existing optional `loved` and `lovedAt` entry fields that an import must preserve, and batch details on the existing `rekonime:watchlist-updated` event.
- Add one atomic `commitEntries` operation to `js/watchlist-state.js`. It validates and serializes a detached candidate payload, writes `rekonime.watchlist` once, and only then replaces the live map contents. It returns failure without changing the live map when persistence fails.
- Add `applyImport(plan)` to `js/watchlist-lifecycle-runtime.ts`. It owns the stale-plan guard, calls `commitEntries` once, and returns the existing transition/effects shape with batch render intent and one Taste Profile refresh intent.
- Wire file reading, full-catalog readiness, preview, and result application in `js/app.ts`. The later UI prototype decides the markup; this contract only requires the App Shell adapter to apply returned effects in order.
- Change `js/taste-profile.ts` only enough to stop persisting Watchlist-derived `inferred` evidence: keep it in memory, rebuild it from current Watchlist entries on app startup before recommendation use, and have the storage writer omit it (or write the empty schema-compatible value). Explicit preferences remain persisted. Loading must ignore any legacy persisted `inferred` value.

No background worker, upload, server endpoint, history store, provider framework, or new dependency is needed.

## Catalog readiness

The App Shell must call and await the existing `loadFullCatalog()` before planning. Planning is allowed only when it succeeds and `isFullDataLoaded === true`; the planner receives that full `animeData` array. It builds one numeric `malId` lookup and matches only `series_animedb_id` to `malId`.

If the full Catalog Payload cannot load, return `catalog_unavailable` and keep the file available for retry. Never fall back to the preview catalog, title matching, or a partially loaded array. The plan records `catalogScope: 'full'`; `applyImport` rejects any other scope.

## Pure parse and plan contract

`parseMalWatchlistXml(text)` has no storage, DOM-rendering, event, clock, or catalog side effects. It returns:

```ts
type MalImportIssue = {
  code: string;
  message: string;
  row?: number;
  field?: string;
};

type ParsedMalRow = {
  row: number;
  malId: number;
  title: string;
  status: 'Plan to Watch' | 'Watching' | 'On-Hold' | 'Completed' | 'Dropped';
  watchedEpisodes: number;
  seriesEpisodes: number | null;
  startedAt: number | null;
  completedAt: number | null;
};

type MalParseResult = {
  ok: boolean;
  rows: ParsedMalRow[];
  invalidRows: Array<{ row: number; title?: string; issues: MalImportIssue[] }>;
  errors: MalImportIssue[];
  warnings: MalImportIssue[];
};
```

Fatal error codes are `empty-input`, `forbidden-declaration`, `malformed-xml`, `unexpected-root`, `no-anime-rows`, and `duplicate-mal-id`. They make `ok: false` and prohibit planning or application. Row-error codes are `missing-field`, `duplicate-field`, `invalid-mal-id`, `invalid-progress`, `invalid-series-episodes`, and `unknown-status`; the affected row is invalid and skipped while otherwise usable rows remain eligible. Warning codes are `unknown-date`, `on-hold-mapped`, `unknown-episode-total`, `progress-clamped`, `completed-progress-normalized`, and `title-mismatch`. Invalid dates and `0000-00-00` become `null`; a valid `YYYY-MM-DD` becomes UTC midnight for that calendar date via `Date.UTC`.

`planMalWatchlistImport({ parseResult, fullCatalog, currentEntries, conflictChoices = {} })` is also pure. Passing a changed choice reruns this function; there is no mutable plan object. It does not call the clock: proposed timestamps that depend on confirmation use the marker `apply-time`, resolved once by `applyImport`. It returns:

```ts
type MatchedImportRow = {
  row: number;
  malId: number;
  catalogId: string;
  sourceTitle: string;
  catalogTitle: string;
  choice: 'create' | 'unchanged';
  proposedEntry: ProposedWatchlistEntry | null;
  warnings: MalImportIssue[];
};

type ConflictingImportRow = {
  row: number;
  malId: number;
  catalogId: string;
  sourceTitle: string;
  catalogTitle: string;
  localEntry: WatchlistEntry;
  proposedEntry: ProposedWatchlistEntry;
  choice: 'keep-rekonime' | 'use-mal';
  warnings: MalImportIssue[];
};

type UnmatchedImportRow = {
  row: number;
  malId: number;
  sourceTitle: string;
  reason: 'catalog-miss';
};

type MalImportSummary = {
  sourceRows: number;
  validRows: number;
  invalid: number;
  matched: number;
  conflicts: number;
  unmatched: number;
  creates: number;
  updates: number;
  unchanged: number;
  keptLocal: number;
  skipped: number;
};

type ProposedWatchlistEntry = Omit<WatchlistEntry, 'updatedAt' | 'startedAt' | 'completedAt'> & {
  updatedAt: number | 'apply-time';
  startedAt?: number | 'apply-time';
  completedAt?: number | 'apply-time';
};

type MalWatchlistImportPlan = {
  ok: boolean;
  catalogScope: 'full';
  baseEntriesFingerprint: string;
  errors: MalImportIssue[];
  warnings: MalImportIssue[];
  matchedRows: MatchedImportRow[];
  conflictingRows: ConflictingImportRow[];
  unmatchedRows: UnmatchedImportRow[];
  invalidRows: MalParseResult['invalidRows'];
  proposedEntries: ProposedWatchlistEntry[];
  summary: MalImportSummary;
};
```

`matchedRows` contains creates and unchanged no-ops. `conflictingRows` contains matched titles whose normalized status or progress differs. `unmatchedRows` and `invalidRows` are explicit skipped results. `proposedEntries` contains only selected creates and explicit `use-mal` updates, never unchanged or kept-local rows.

The base fingerprint is deterministic JSON of normalized current entries sorted by `id`; no hashing dependency is needed. It prevents a preview from overwriting Watchlist changes made before confirmation. Summary invariants are:

- `sourceRows = validRows + invalid`
- `validRows = matched + conflicts + unmatched`
- `matched = creates + unchanged`
- `conflicts = updates + keptLocal`
- `skipped = invalid + unmatched + keptLocal`

Status, progress, date, affinity, repeated-import, and default-choice behavior are exactly those resolved in [Decide Watchlist merge and conflict semantics](../tickets/decide-merge-and-conflict-semantics.md). Every created entry includes a Snapshot built from its matched full-catalog record. An updated entry preserves its existing Snapshot unless missing, when the planner supplies the full-catalog Snapshot. Snapshot creation is therefore part of the detached candidate, not a second post-commit write.

## Single apply boundary

`applyImport(plan)` returns:

```ts
type MalImportApplyResult =
  | {
      status: 'applied';
      changed: true;
      appliedAt: number;
      changedIds: string[];
      summary: MalImportSummary;
      transition: WatchlistTransitionEnvelope;
      effects: {
        refreshTasteProfile: true;
        renderRecommendations: true;
        updateTasteProfileUi: true;
      };
    }
  | { status: 'no-changes'; changed: false; summary: MalImportSummary }
  | {
      status: 'rejected';
      changed: false;
      reason: 'invalid-plan' | 'catalog-not-full' | 'stale-plan' | 'storage-failed';
      summary?: MalImportSummary;
    };
```

Application order is fixed:

1. Without mutation, require `plan.ok`, `catalogScope: 'full'`, valid summary invariants, normalized proposed entries, and an unchanged current-entry fingerprint. Resolve all `apply-time` markers from one timestamp and build the complete detached next-entry map, preserving every entry not selected for change.
2. Validate and serialize the complete Watchlist payload before writing.
3. Call `commitEntries` once. It writes the single `rekonime.watchlist` payload first, then swaps the live map. A false return yields `storage-failed`; no entry, event, render, Snapshot, or Taste Profile state changes.
4. Return one batch transition using the existing `rekonime:watchlist-updated` event with optional `operation: 'import'`, `changedIds`, and `summary` details. Its render intent refreshes Watchlist presentation once and schedules the Airing dashboard once; per-row events and toasts are prohibited.
5. The App Shell applies that Watchlist event/render intent, then calls `updateInferredFromWatchlist` exactly once with the committed entries, then updates Taste Profile UI and recommendations once. Because inferred evidence is derived in memory rather than a second durable import write, it cannot make the Watchlist commit partial.

An accepted plan with no creates or updates returns `no-changes` without a storage write, event, Snapshot refresh, or Taste Profile refresh.

## Failure and recovery boundary

There is no rollback path because no partial Watchlist mutation is permitted. All parse, catalog, choice, normalization, stale-plan, and serialization checks occur before the one storage write. Browser `localStorage.setItem` is the commit point for the Watchlist key; failure leaves the prior persisted payload and live map untouched. Retry requires regenerating the plan if its fingerprint is stale; otherwise the same preview may be applied again.

The subsequent acceptance ticket must verify detached-write behavior with a storage adapter that returns false and one that throws, plus the single event/render/Taste refresh counts. It does not need to decide further transaction semantics.

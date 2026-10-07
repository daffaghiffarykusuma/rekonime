import type { MalImportPlan, MalParseResult } from './mal-import-plan.ts';
import type { WatchlistEntry } from './contracts/watchlist-lifecycle.ts';

type ImportFile = { name?: string; text(): Promise<string> };
type ImportTools = Pick<typeof import('./mal-watchlist-import.ts'), 'parseMalWatchlistXml' | 'planMalWatchlistImport'>;
type ImportResult = { changed: boolean; compatibilityResult?: { status?: string; reason?: string } };
type ImportReview = Pick<MalImportPlan, 'summary' | 'invalidRows' | 'unmatchedRows' | 'warnings'> & {
  conflicts: Array<Pick<MalImportPlan['conflicts'][number], 'id' | 'title' | 'incoming' | 'useMal'> & {
    local: Pick<WatchlistEntry, 'status' | 'progress'>;
  }>;
};

export type WatchlistImportView = {
  stage: 'choose' | 'loading' | 'review' | 'error' | 'success' | 'partial-success';
  fileName: string;
  error: string;
  retry: 'file' | 'review' | 'recommendations' | null;
  noChanges: boolean;
  review?: ImportReview;
};

export type WatchlistImportUpdate = {
  focus: 'loading' | 'review' | 'error' | 'success' | 'file' | { conflictId: string; useMal: boolean };
  announcement?: string;
  closeConfirmation?: boolean;
};

type Dependencies<Result extends ImportResult> = {
  loadTools?: () => Promise<ImportTools>;
  getFullCatalog(): Promise<Array<Record<string, any>> | null>;
  getEntries(): WatchlistEntry[];
  applyPlan(plan: MalImportPlan): Result;
  applyEffects(result: Result): void;
  refreshRecommendations(): void;
  onUpdate(update: WatchlistImportUpdate): void;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const createWatchlistImportWorkflow = <Result extends ImportResult>({
  loadTools = () => import('./mal-watchlist-import.ts'),
  getFullCatalog, getEntries, applyPlan, applyEffects, refreshRecommendations, onUpdate
}: Dependencies<Result>) => {
  let stage: WatchlistImportView['stage'] = 'choose';
  let file: ImportFile | null = null;
  let error = '';
  let fileReadFailed = false;
  let noChanges = false;
  let generation = 0;
  let tools: ImportTools | null = null;
  let toolsPromise: Promise<ImportTools> | null = null;
  let parseResult: MalParseResult | null = null;
  let catalog: Array<Record<string, any>> = [];
  let reviewEntries: WatchlistEntry[] = [];
  let choices: Record<string, boolean> = {};
  let plan: MalImportPlan | null = null;

  const getView = (): WatchlistImportView => ({
    stage, fileName: file ? file.name || 'MyAnimeList XML' : '', error, noChanges,
    retry: stage === 'partial-success' ? 'recommendations'
      : stage === 'error' && file ? fileReadFailed ? 'file' : 'review' : null,
    ...(plan && ['review', 'success', 'partial-success'].includes(stage) ? {
      review: clone({
        summary: plan.summary, invalidRows: plan.invalidRows, unmatchedRows: plan.unmatchedRows,
        warnings: plan.warnings, conflicts: plan.conflicts.map(({ id, title, local, incoming, useMal }) => ({
          id, title, local: { status: local.status, progress: local.progress }, incoming, useMal
        }))
      })
    } : {})
  });

  const reset = () => {
    file = null;
    error = '';
    fileReadFailed = false;
    noChanges = false;
    parseResult = null;
    catalog = [];
    reviewEntries = [];
    choices = {};
    plan = null;
  };

  const getTools = async () => {
    if (tools) return tools;
    toolsPromise ??= Promise.resolve().then(loadTools)
      .then(loaded => { tools = loaded; return loaded; })
      .finally(() => { toolsPromise = null; });
    return toolsPromise;
  };

  const review = async (selected: ImportFile | null | undefined) => {
    if (!selected) return;
    const request = ++generation;
    reset();
    file = selected;
    stage = 'loading';
    onUpdate({ focus: 'loading', announcement: 'Preparing import review.' });
    try {
      const parser = await getTools().catch(() => {
        throw new Error('The import tools could not load. Check your connection and retry this review.');
      });
      if (generation !== request) return;
      let text: string;
      try { text = await selected.text(); }
      catch {
        if (generation !== request) return;
        fileReadFailed = true;
        throw new Error('We could not read this file. Try again or choose another XML export.');
      }
      if (generation !== request) return;
      parseResult = parser.parseMalWatchlistXml(text);
      if (!parseResult.ok) throw new Error('This XML export cannot be imported. Check for malformed XML, repeated IDs, or unsupported document declarations, then choose a corrected file.');
      const fullCatalog = await getFullCatalog();
      if (generation !== request) return;
      if (!fullCatalog) throw new Error('The full catalog is unavailable. Retry this review when your connection is ready.');
      catalog = fullCatalog;
      reviewEntries = clone(getEntries());
      plan = parser.planMalWatchlistImport({ parseResult, fullCatalog: catalog, currentEntries: reviewEntries });
      if (!plan.ok) throw new Error('The import review could not be prepared. Your Watchlist is unchanged.');
      stage = 'review';
      onUpdate({ focus: 'review', announcement: 'Import review ready. Nothing has changed.' });
    } catch (failure) {
      if (generation !== request) return;
      stage = 'error';
      error = failure instanceof Error ? failure.message : 'The import review could not be prepared. Your Watchlist is unchanged.';
      onUpdate({ focus: 'error' });
    }
  };

  const choose = (id: string, useMal: boolean) => {
    if (stage !== 'review' || !tools || !parseResult || !plan?.conflicts.some(conflict => conflict.id === id)) return;
    choices = { ...choices, [id]: useMal };
    plan = tools.planMalWatchlistImport({ parseResult, fullCatalog: catalog, currentEntries: reviewEntries, choices });
    onUpdate({ focus: { conflictId: id, useMal },
      announcement: `${plan.summary.creates + plan.summary.updates} changes selected, ${plan.summary.skipped} rows skipped.` });
  };

  const cancel = () => {
    generation += 1;
    reset();
    stage = 'choose';
    onUpdate({ focus: 'file', announcement: 'Import cancelled. Your Watchlist is unchanged.' });
  };

  const apply = (): Result | undefined => {
    if (stage !== 'review' || !plan) return;
    const result = applyPlan(plan);
    if (result.compatibilityResult?.status === 'rejected') {
      const stale = result.compatibilityResult.reason === 'stale-plan';
      stage = stale ? 'error' : 'review';
      error = stale ? 'Your Watchlist changed after this review. Retry to review the latest values.'
        : 'Changes could not be saved. Your previous Watchlist is intact. Try applying again.';
      onUpdate({ focus: 'error', closeConfirmation: true });
      return result;
    }
    // Effects can synchronously render settings. They must see the committed state.
    stage = 'success';
    error = '';
    noChanges = !result.changed;
    try {
      if (result.changed) applyEffects(result);
      onUpdate({ focus: 'success', closeConfirmation: true,
        announcement: result.changed ? 'Watchlist import complete.' : 'No Watchlist changes were needed.' });
    } catch {
      stage = 'partial-success';
      onUpdate({ focus: 'success', closeConfirmation: true, announcement: 'Watchlist imported; recommendations need refresh.' });
    }
    return result;
  };

  const retry = () => {
    if (stage === 'partial-success') {
      try {
        refreshRecommendations();
        stage = 'success';
        onUpdate({ focus: 'success', announcement: 'Watchlist imported and recommendations refreshed.' });
      } catch {
        stage = 'partial-success';
        onUpdate({ focus: 'success', announcement: 'Watchlist imported; recommendations need refresh.' });
      }
    } else if (stage === 'error' && file) {
      if (fileReadFailed) onUpdate({ focus: 'file' });
      else return review(file);
    }
  };

  return { getView, review, choose, cancel, apply, retry };
};

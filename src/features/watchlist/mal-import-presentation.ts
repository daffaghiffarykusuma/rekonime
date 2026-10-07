import type { WatchlistImportView } from './watchlist-import-workflow.ts';

const statusLabel = { planned: 'Want to watch', watching: 'Watching now', completed: 'Finished', dropped: 'Stopped' };
const issueLabel = (reason: string) => ({
  'catalog-miss': 'Not in the Rekonime catalog', 'invalid-progress': 'Invalid episode progress',
  'invalid-mal-id': 'Invalid MyAnimeList ID', 'unknown-status': 'Unknown watch status',
  'invalid-episode-total': 'Invalid episode total', 'progress-clamped': 'Progress reduced to the catalog episode total',
  'completed-progress-normalized': 'Finished progress set to the catalog episode total',
  'title-differs-from-catalog': 'Title differs; matched by MyAnimeList ID',
  'on-hold-mapped-to-watching': 'On-Hold becomes Watching now', 'unknown-episode-total': 'Episode total unknown',
  'unknown-my_start_date': 'Start date unknown', 'unknown-my_finish_date': 'Finish date unknown'
} as Record<string, string>)[reason] || 'Missing or repeated required field';

const renderMalImport = (state: WatchlistImportView | null | undefined, escape: (value: any) => string, escapeAttr: (value: any) => string) => {
  state ||= { stage: 'choose', fileName: '', error: '', retry: null, noChanges: false };
  const plan = state.review;
  const summary = plan?.summary;
  const status = '<p class="visually-hidden" id="mal-import-status" role="status" aria-live="polite" aria-atomic="true"></p>';
  const button = (action: string, text: string) => `<button class="btn btn-outline btn-sm" type="button" data-action="${action}">${text}</button>`;
  if (state.stage === 'success' || state.stage === 'partial-success') {
    return `<section class="mal-watchlist-import" aria-labelledby="mal-import-success-heading">
      <h3 id="mal-import-success-heading" tabindex="-1">${state.stage === 'partial-success' ? 'Watchlist imported; recommendations need refresh' : state.noChanges ? 'Your Watchlist is already up to date' : `${summary?.creates || 0} Watchlist entries imported`}</h3>
      <p>${summary?.updates || 0} updated, ${summary?.skipped || 0} skipped. Your saved Watchlist changes are complete.</p>
      ${state.stage === 'partial-success' ? button('retry-mal-recommendations', 'Refresh recommendations') : state.noChanges ? '<p>Your Watchlist is already current.</p>' : '<p>Your Taste Profile has been refreshed.</p>'}
      ${button('cancel-mal-watchlist-import', 'Import another XML')}${status}</section>`;
  }
  if (state.stage === 'loading') return `<section class="mal-watchlist-import" aria-busy="true"><h3 id="mal-import-loading" tabindex="-1">Preparing import review</h3><p>Reading your XML and loading the full catalog. Your Watchlist is unchanged.</p>${button('cancel-mal-watchlist-import', 'Cancel import')}${status}</section>`;
  if (state.stage === 'review' && summary && plan) {
    const examples = (issues: Array<{ row: number; sourceTitle: string; reason: string }>) => issues.length
      ? `<ul>${issues.slice(0, 5).map(issue => `<li>Row ${issue.row}: ${escape(issue.sourceTitle || 'Untitled row')}. ${escape(issueLabel(issue.reason))}</li>`).join('')}</ul>${issues.length > 5 ? `<p>${issues.length - 5} more. All rows are included in the totals.</p>` : ''}` : '<p>None.</p>';
    const changes = summary.creates + summary.updates;
    return `<section class="mal-watchlist-import" aria-labelledby="mal-import-review-heading">
      <span class="mal-import-eyebrow">Watchlist import · ${escape(state.fileName)}</span>
      <h3 id="mal-import-review-heading" tabindex="-1">${summary.sourceRows} rows are ready to review</h3>
      <p>Nothing changes until you confirm. Matches use exact MyAnimeList IDs from the full catalog.</p>
      ${state.error ? `<p id="mal-import-error" role="alert" tabindex="-1">${escape(state.error)}</p>` : ''}
      <div class="mal-import-counts" aria-label="Import summary">${[
        ['sourceRows', 'rows'], ['matched', 'matched'], ['creates', 'new'], ['updates', 'updates'],
        ['conflicts', 'conflicts'], ['unchanged', 'unchanged'], ['invalid', 'invalid'], ['unmatched', 'unmatched'], ['skipped', 'skipped']
      ].map(([key, label]) => `<div><strong data-mal-count="${key}">${summary[key as keyof typeof summary]}</strong><span>${label}</span></div>`).join('')}</div>
      <div class="mal-import-review-layout"><div><h4>Progress conflicts</h4><p>Keep Rekonime is selected by default. Your loved state and existing dates are preserved.</p>
      ${plan.conflicts.length ? plan.conflicts.map(conflict => `<fieldset class="mal-import-conflict">
        <legend>${escape(conflict.title)}</legend>
        <p>Rekonime: ${statusLabel[conflict.local.status]}, ${conflict.local.progress} episodes</p>
        <p>MAL: ${statusLabel[conflict.incoming.status]}, ${conflict.incoming.progress} episodes</p>
        <label><input type="radio" name="mal-choice-${escapeAttr(conflict.id)}" data-action="mal-conflict-choice" data-anime-id="${escapeAttr(conflict.id)}" value="keep" ${!conflict.useMal ? 'checked' : ''} aria-label="Keep Rekonime for ${escapeAttr(conflict.title)}"> Keep Rekonime</label>
        <label><input type="radio" name="mal-choice-${escapeAttr(conflict.id)}" data-action="mal-conflict-choice" data-anime-id="${escapeAttr(conflict.id)}" value="mal" ${conflict.useMal ? 'checked' : ''} aria-label="Use MAL for ${escapeAttr(conflict.title)}"> Use MAL</label>
      </fieldset>`).join('') : '<p>No progress conflicts.</p>'}</div>
      <aside><h4>Invalid rows</h4>${examples(plan.invalidRows)}<h4>Unmatched titles</h4>${examples(plan.unmatchedRows)}<h4>Warnings</h4>${examples(plan.warnings)}</aside></div>
      <div class="mal-import-actions">${button('cancel-mal-watchlist-import', 'Cancel import')}
      <button class="btn btn-primary" type="button" data-action="confirm-mal-watchlist-import">Review ${changes} Watchlist changes</button></div>
      <dialog class="mal-import-dialog" id="mal-import-confirmation" aria-labelledby="mal-import-confirm-title" aria-describedby="mal-import-confirm-description">
        <form method="dialog"><h3 id="mal-import-confirm-title">Apply ${changes} Watchlist changes?</h3>
        <p id="mal-import-confirm-description">This adds ${summary.creates} entries, updates ${summary.updates}, and skips ${summary.skipped} rows. Loved state and existing dates stay unchanged. Your Taste Profile refreshes once.</p>
        <p>You cannot undo this as one action. Export a Rekonime backup first if you may need to restore the current state.</p>
        <div class="mal-import-actions"><button class="btn btn-outline" value="cancel">Go back</button><button class="btn btn-primary" value="apply" data-action="apply-mal-watchlist-import">Apply Watchlist changes</button></div></form>
      </dialog>${status}</section>`;
  }
  return `<section class="mal-watchlist-import" aria-labelledby="mal-import-heading"><span class="mal-import-eyebrow">Watchlist import</span>
    <h3 id="mal-import-heading" tabindex="-1">Bring progress in from MyAnimeList</h3>
    <p>Choose your MyAnimeList XML export. Rekonime reads it locally and changes nothing until you confirm.</p>
    ${state.error ? `<p id="mal-import-error" role="alert" tabindex="-1">${escape(state.error)}</p>${state.retry ? button('retry-mal-watchlist-import', state.retry === 'file' ? 'Retry file selection' : 'Retry import review') : ''}` : ''}
    <input id="mal-watchlist-import-file" class="mal-import-file" type="file" aria-label="MyAnimeList XML export" accept=".xml,application/xml,text/xml" data-action="mal-watchlist-file">
    <p>This merges Watchlist progress only. Rekonime JSON backup restore replaces saved personal data and is separate below.</p>${status}</section>`;
};

export { renderMalImport };

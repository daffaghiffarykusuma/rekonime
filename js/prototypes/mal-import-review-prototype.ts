// @ts-nocheck
// PROTOTYPE — Winning summary-first MAL import review flow on the existing settings route.
import { setHTML } from '../security/trusted-types.js';
import './mal-import-review-prototype.css';

const conflicts = [
  ['Sousou no Frieren', 'Watching · 12/28', 'Completed · 28/28'],
  ['Dungeon Meshi', 'Watching · 18/24', 'Completed · 24/24'],
  ['Bocchi the Rock!', 'Planned · 0/12', 'Completed · 12/12'],
  ['Vinland Saga Season 2', 'Dropped · 8/24', 'Completed · 24/24'],
  ['Kusuriya no Hitorigoto', 'Watching · 10/24', 'Completed · 24/24']
];

const unmatched = [
  ['5-toubun no Hanayome Movie', 'Movie'],
  ['Asagao to Kase-san.', 'OVA'],
  ["BanG Dream! It's MyGO!!!!! / Ave Mujica", 'TV']
];

const state = {
  stage: 'choose',
  fileName: '',
  useMal: new Set()
};

export const isMalImportPrototype = () => import.meta.env.DEV
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('prototype') === 'mal-import-review';

const summary = () => {
  const updates = state.useMal.size;
  return {
    changes: 330 + updates,
    updates,
    skipped: 85 - updates
  };
};

const status = () => '<p class="visually-hidden" id="mal-import-status" role="status" aria-live="polite" aria-atomic="true"></p>';

const filePicker = () => `
  <div class="mal-file-picker">
    <label class="settings-title" for="mal-import-file">MyAnimeList XML export</label>
    <p class="settings-description">Choose the XML file downloaded from MyAnimeList. Rekonime reads it locally and changes nothing until you confirm.</p>
    <input id="mal-import-file" class="mal-file-input" type="file" accept=".xml,application/xml,text/xml">
    <p class="mal-field-hint">For this prototype, any XML file loads the observed 415-row review scenario.</p>
  </div>`;

const personalDataCard = () => `
  <aside class="mal-json-card" aria-labelledby="rekonime-json-title">
    <div>
      <h3 id="rekonime-json-title">Rekonime backup</h3>
      <p>Rekonime JSON restores a full personal-data backup. It remains separate from MAL progress import.</p>
    </div>
    <button class="btn btn-outline btn-sm" type="button" disabled title="Not wired in this throwaway prototype">Import Rekonime JSON</button>
  </aside>`;

const counts = ({ compact = false } = {}) => `
  <div class="mal-counts ${compact ? 'mal-counts--compact' : ''}" aria-label="Import summary">
    <div><strong>415</strong><span>rows</span></div>
    <div class="is-good"><strong>330</strong><span>new</span></div>
    <div class="is-warning"><strong>5</strong><span>conflicts</span></div>
    <div><strong>4</strong><span>unchanged</span></div>
    <div class="is-muted"><strong>76</strong><span>unmatched</span></div>
  </div>`;

const conflictRows = ({ condensed = false } = {}) => `
  <div class="mal-exception-list ${condensed ? 'is-condensed' : ''}">
    ${conflicts.map(([title, local, mal], index) => `
      <fieldset class="mal-conflict-row">
        <legend>${title}</legend>
        <div class="mal-choice-grid">
          <label>
            <input type="radio" name="conflict-${index}" value="local" data-conflict="${index}" ${state.useMal.has(index) ? '' : 'checked'}>
            <span><strong>Keep Rekonime</strong><small>${local}</small></span>
          </label>
          <label>
            <input type="radio" name="conflict-${index}" value="mal" data-conflict="${index}" ${state.useMal.has(index) ? 'checked' : ''}>
            <span><strong>Use MAL</strong><small>${mal}</small></span>
          </label>
        </div>
      </fieldset>`).join('')}
  </div>`;

const unmatchedRows = () => `
  <details class="mal-unmatched">
    <summary>76 unmatched titles — skipped</summary>
    <p class="settings-description">No exact MAL ID exists in Rekonime’s catalog. These titles will not create Watchlist entries.</p>
    <ul>
      ${unmatched.map(([title, type]) => `<li><span>${title}</span><small>${type}</small></li>`).join('')}
    </ul>
    <p class="mal-field-hint">Showing 3 examples. The remaining 73 stay summarized for this 415-row file.</p>
  </details>`;

const actions = () => {
  const result = summary();
  return `
    <div class="mal-actions">
      <button class="btn btn-outline" type="button" data-mal-action="cancel">Cancel import</button>
      <button class="btn btn-primary" type="button" data-mal-action="confirm">Review ${result.changes} Watchlist changes</button>
    </div>`;
};

const chooseView = () => `
  <section class="mal-prototype mal-variant-b" aria-labelledby="mal-import-heading">
    <header class="mal-prototype-header">
      <span class="mal-eyebrow">Watchlist import</span>
      <h2 id="mal-import-heading" tabindex="-1">Bring progress in from MyAnimeList</h2>
      <p>Your Rekonime profile stays intact. You will review every conflict before anything changes.</p>
    </header>
    <div class="mal-b-split"><div>${filePicker()}</div><div class="mal-empty-preview"><strong>Review before applying</strong><span>Matched, conflicting, unchanged, and unmatched rows appear here.</span></div></div>
    ${personalDataCard()}
    ${status()}
  </section>`;

const reviewView = () => `
  <section class="mal-prototype mal-variant-b" aria-labelledby="mal-review-heading">
    <header class="mal-prototype-header mal-b-header">
      <div><span class="mal-eyebrow">${state.fileName}</span><h2 id="mal-review-heading" tabindex="-1">415 rows are ready to review</h2></div>
      <button class="btn btn-outline btn-sm" type="button" data-mal-action="cancel">Choose another file</button>
    </header>
    ${counts()}
    <div class="mal-b-split">
      <section aria-labelledby="mal-conflict-title"><h3 id="mal-conflict-title">Decisions needed</h3><p class="settings-description">Five local entries differ. Nothing is overwritten unless you choose Use MAL.</p>${conflictRows({ condensed: true })}</section>
      <aside class="mal-b-rail"><h3>Skipped safely</h3>${unmatchedRows()}<p><strong>4 unchanged</strong><br><span class="settings-description">Already identical; no rewrite.</span></p></aside>
    </div>
    ${actions()}
    ${personalDataCard()}
    ${status()}
  </section>`;

const errorView = () => `
  <section class="mal-prototype mal-variant-b" aria-labelledby="mal-error-heading">
    <div class="mal-error" role="alert">
      <span aria-hidden="true">!</span>
      <div><h2 id="mal-error-heading" tabindex="-1">That file could not be reviewed</h2><p>Choose a MyAnimeList XML export. Rekonime has not changed your Watchlist.</p></div>
    </div>
    ${filePicker()}
    <button class="btn btn-outline" type="button" data-mal-action="retry">Retry file selection</button>
    ${personalDataCard()}
    ${status()}
  </section>`;

const successView = () => {
  const result = summary();
  return `
    <section class="mal-prototype mal-variant-b mal-success" aria-labelledby="mal-success-heading">
      <span class="mal-success-mark" aria-hidden="true">✓</span>
      <span class="mal-eyebrow">Import complete</span>
      <h2 id="mal-success-heading" tabindex="-1">Your Watchlist and Taste Profile are up to date</h2>
      <p>This prototype did not write to storage. The production flow would report:</p>
      <div class="mal-result-grid">
        <div><strong>${result.changes}</strong><span>Watchlist changes</span></div>
        <div><strong>${result.updates}</strong><span>conflicts used MAL</span></div>
        <div><strong>${result.skipped}</strong><span>unchanged or skipped</span></div>
        <div><strong>1</strong><span>Taste Profile refresh</span></div>
      </div>
      <div class="mal-actions"><a class="btn btn-primary" href="/watchlist.html">View Watchlist</a><button class="btn btn-outline" type="button" data-mal-action="again">Import another XML</button></div>
      ${personalDataCard()}
      ${status()}
    </section>`;
};

const confirmDialogContent = () => {
  const result = summary();
  return `
    <form method="dialog">
      <span class="mal-eyebrow">Final confirmation</span>
      <h2 id="mal-confirm-title">Apply ${result.changes} Watchlist changes?</h2>
      <p id="mal-confirm-description">This will add 330 entries${result.updates ? ` and replace status or progress for ${result.updates}` : ''}. It will preserve local loved evidence, skip ${result.skipped} rows, then refresh the Taste Profile once.</p>
      <p><strong>You cannot undo this as one action.</strong> Export a Rekonime backup first if you may need to restore the current state.</p>
      <div class="mal-actions"><button class="btn btn-outline" value="cancel">Go back</button><button class="btn btn-primary" value="apply" data-mal-action="apply">Apply Watchlist changes</button></div>
    </form>`;
};

const confirmDialog = () => `<dialog class="mal-confirm-dialog" id="mal-confirm-dialog" aria-labelledby="mal-confirm-title" aria-describedby="mal-confirm-description">${confirmDialogContent()}</dialog>`;

export const renderMalImportPrototype = () => {
  const view = state.stage === 'review' ? reviewView()
    : state.stage === 'error' ? errorView()
      : state.stage === 'success' ? successView()
        : chooseView();
  return `${view}${confirmDialog()}`;
};

const announce = (message) => {
  const live = document.getElementById('mal-import-status');
  if (live) live.textContent = message;
};

const focusHeading = (id) => requestAnimationFrame(() => document.getElementById(id)?.focus());

const rerender = (container, focusId) => {
  setHTML(container, renderMalImportPrototype());
  if (focusId) focusHeading(focusId);
};

export const setupMalImportPrototype = (container) => {
  if (!isMalImportPrototype() || !container || container.dataset.malPrototypeReady === 'true') return;
  container.dataset.malPrototypeReady = 'true';

  container.addEventListener('change', (event) => {
    const target = event.target;
    if (target.id === 'mal-import-file') {
      const file = target.files?.[0];
      if (!file) return;
      state.fileName = file.name;
      state.useMal.clear();
      state.stage = file.name.toLowerCase().endsWith('.xml') ? 'review' : 'error';
      rerender(container, state.stage === 'review' ? 'mal-review-heading' : 'mal-error-heading');
      announce(state.stage === 'review'
        ? 'File reviewed. 330 new, 5 conflicts, 4 unchanged, and 76 unmatched rows.'
        : 'File could not be reviewed. No Watchlist changes were made.');
      return;
    }
    if (target.matches('[data-conflict]')) {
      const index = Number(target.dataset.conflict);
      target.value === 'mal' ? state.useMal.add(index) : state.useMal.delete(index);
      const button = container.querySelector('[data-mal-action="confirm"]');
      if (button) button.textContent = `Review ${summary().changes} Watchlist changes`;
      announce(`${state.useMal.size} conflicts will use MAL. ${5 - state.useMal.size} will keep Rekonime.`);
    }
  });

  container.addEventListener('click', (event) => {
    const action = event.target.closest('[data-mal-action]')?.dataset.malAction;
    if (!action) return;
    if (action === 'cancel' || action === 'again') {
      state.stage = 'choose';
      state.fileName = '';
      state.useMal.clear();
      rerender(container, 'mal-import-heading');
      announce('Import canceled. The Watchlist is unchanged.');
      return;
    }
    if (action === 'retry') {
      document.getElementById('mal-import-file')?.focus();
      return;
    }
    if (action === 'confirm') {
      const dialog = document.getElementById('mal-confirm-dialog');
      if (dialog) setHTML(dialog, confirmDialogContent());
      dialog?.showModal();
      requestAnimationFrame(() => dialog?.querySelector('[value="cancel"]')?.focus());
      return;
    }
    if (action === 'apply') {
      state.stage = 'success';
      requestAnimationFrame(() => {
        rerender(container, 'mal-success-heading');
        announce(`Import complete. ${summary().changes} Watchlist changes and one Taste Profile refresh.`);
      });
    }
  });
};

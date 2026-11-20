// @ts-nocheck
import { HealthMonitor } from '../shared/runtime/healthMonitor.js';
import { SidebarPreference } from '../shared/ui/sidebar-preference.ts';

/**
 * Home page click commands, keyed by `data-action`.
 *
 * The click delegate is the adapter at the DOM seam: it finds the action element and looks the
 * action up here. Each command reads what it needs from the element and calls one domain
 * module (Watchlist Lifecycle Runtime, Discovery Shortlist, Browse View Filtering, Detail
 * Experience) through the App. Domain rules belong in those modules, not in these commands.
 *
 * A command receives `{ app, element, event, data }` where `data` is `element.dataset`.
 * Actions that are handled by other delegates (change events, the Watchlist page, keyboard
 * shortcuts) are listed in NON_CLICK_ACTIONS so the table test can account for every action.
 */

const stop = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const focusNextWatchControl = (element) => {
  const controls = element?.closest?.('.detail-watchlist-controls, .watchlist-controls');
  if (!controls || !element.classList.contains('is-hidden')) return;
  const next = controls.querySelector('.watchlist-start-btn:not(.is-hidden), .watchlist-progress:not(.is-hidden) input, .watchlist-controls-progress:not(.is-hidden) input, select');
  next?.focus?.();
};

const titleOrCurrent = (app, data) => data.animeId || app.currentAnimeId;

const shortlist = (action, { stopEvent = true } = {}) => ({ app, data, event }) => {
  if (stopEvent) stop(event);
  app.runShortlistAction(action, data.animeId);
};

const feedback = (action) => ({ app, element, data, event }) => {
  stop(event);
  if (data.animeId) app.handleRecommendationFeedback(action, data.animeId, element);
};

const selectTab = (tabs, isActive, { roving = false } = {}) => tabs.forEach(tab => {
  const active = isActive(tab);
  tab.classList.toggle('is-active', active);
  tab.setAttribute('aria-selected', String(active));
  if (roving) tab.setAttribute('tabindex', active ? '0' : '-1');
});

const showPanels = (panels, isActive) => panels.forEach(panel => {
  const active = isActive(panel);
  panel.classList.toggle('is-active', active);
  panel.toggleAttribute('hidden', !active);
});

const HOME_ACTION_COMMANDS = {
  // Discovery Shortlist
  'quick-save-recommendation': shortlist('quick-save-recommendation'),
  'undo-recommendation-selection': shortlist('undo-recommendation-selection'),
  'skip-recommendation': shortlist('skip-recommendation'),
  'restore-session-dismissal': shortlist('restore-session-dismissal'),
  'more-recommendations': shortlist('more-recommendations', { stopEvent: false }),
  'rec-more-like': feedback('rec-more-like'),
  'rec-not-for-me': feedback('rec-not-for-me'),
  'rec-less-tag': feedback('rec-less-tag'),
  'rec-already-seen': feedback('rec-already-seen'),
  'surprise-me': ({ app }) => app.showSurpriseMe(),
  'explain-recommendations': ({ app }) => app.showRecommendationsHelp(),

  // Watchlist Lifecycle
  'continue-progress': ({ app, data }) => app.advanceWatchProgress(data.animeId),
  'watch-progress-inc': ({ app, data }) => {
    const animeId = titleOrCurrent(app, data);
    if (animeId) app.adjustWatchProgress(animeId, 1);
  },
  'watch-progress-dec': ({ app, data }) => {
    const animeId = titleOrCurrent(app, data);
    if (animeId) app.adjustWatchProgress(animeId, -1);
  },
  // The pressed button hides once the status changes, so hand focus to the
  // control that now holds the next step instead of dropping it to the page.
  'watch-plan': ({ app, element, data }) => {
    const animeId = titleOrCurrent(app, data);
    if (!animeId) return;
    app.setWatchStatus(animeId, 'planned');
    focusNextWatchControl(element);
  },
  'watch-start': ({ app, element, data }) => {
    const animeId = titleOrCurrent(app, data);
    if (!animeId) return;
    app.setWatchStatus(animeId, 'watching');
    focusNextWatchControl(element);
  },
  'watch-loved': ({ app, data }) => {
    const animeId = titleOrCurrent(app, data);
    if (animeId) app.toggleWatchLoved(animeId);
  },

  // Browse View Filtering
  'home-shortcut': ({ app, event }) => {
    if (!app.isCatalogPage()) return;
    event.preventDefault();
    if (app.currentAnimeId) app.closeDetailModal({ updateUrl: false });
    app.clearAllFilters();
  },
  'toggle-filter': ({ app, element, data }) => {
    if (data.filterType && data.filterValue !== undefined) app.toggleFilter(data.filterType, data.filterValue);
    if (element.classList.contains('quick-chip') && app.getActiveFilterCount() >= 2) app.scrollToResultsSection();
  },
  'clear-search': ({ app }) => app.clearHeaderSearchQuery({ scroll: true }),
  'quick-tab': ({ element, data }) => {
    const tabs = document.querySelectorAll('.quick-tab');
    const tracks = document.querySelectorAll('.quick-filters-track');
    if (!data.tab || tabs.length === 0 || tracks.length === 0) return;
    selectTab(tabs, tab => tab === element, { roving: true });
    showPanels(tracks, track => track.dataset.filterGroup === data.tab);
  },
  'toggle-quick-more': ({ app, data }) => {
    const state = app.quickFilterState[data.filterType];
    if (!data.filterType || !state) return;
    state.expanded = !state.expanded;
    app.renderQuickFilters();
  },
  'apply-preset': ({ app, data }) => {
    if (data.preset) app.applyFilterPreset(data.preset);
  },
  'apply-seasonal': ({ app, data }) => {
    if (data.seasonYear) app.applySeasonalFilter(data.seasonYear);
  },
  'scroll-to-filters': ({ app }) => app.scrollToFiltersSection(),
  'scroll-to-results': ({ app }) => app.scrollToResultsSection(),
  'load-more': ({ app }) => app.loadMoreAnime(),

  // Detail Experience
  'open-anime': ({ app, element, data }) => {
    if (data.animeId) app.showAnimeDetail(data.animeId);
    if (element.closest('.header-search-dropdown')) app.resetHeaderSearch({ clearInput: true });
  },
  'close-detail': ({ app }) => app.closeDetailModal(),
  'detail-tab': ({ element, data }) => {
    const root = element.closest('.detail-tabs');
    if (!data.detailTab || !root) return;
    selectTab(root.querySelectorAll('[role="tab"]'), tab => tab.dataset.detailTab === data.detailTab);
    showPanels(root.querySelectorAll('[data-detail-panel]'), panel => panel.dataset.detailPanel === data.detailTab);
  },
  'toggle-trailer': ({ app }) => app.detailExperience?.toggleTrailerPlayback(),
  'retry-reviews': ({ app }) => void app.detailExperience?.refreshCommunityReviews(),
  'retry-detail': ({ app }) => void app.detailExperience?.retry(),

  // Taste Profile, Personal Data Restore, and Watchlist Import
  'edit-taste-profile': ({ app }) => {
    app.ensureSettingsRendered();
    app.getRuntimeCapabilities().setModalVisibility('settings-modal', true, { initialFocusSelector: '#taste-profile-heading' });
    document.getElementById('taste-profile-heading')?.scrollIntoView({ block: 'start' });
    requestAnimationFrame(() => document.getElementById('taste-profile-heading')?.focus({ preventScroll: true }));
  },
  'reset-taste-profile': ({ app }) => app.resetTasteProfile(),
  'export-personal-data': ({ app }) => app.exportPersonalData(),
  'restore-personal-data': () => document.getElementById('personal-data-restore')?.click(),
  'retry-mal-watchlist-import': ({ app }) => void app.getWatchlistImportWorkflow().retry(),
  'retry-mal-recommendations': ({ app }) => void app.getWatchlistImportWorkflow().retry(),
  'cancel-mal-watchlist-import': ({ app }) => app.getWatchlistImportWorkflow().cancel(),
  'confirm-mal-watchlist-import': ({ app }) => app.openMalWatchlistConfirmation(),
  'apply-mal-watchlist-import': ({ app }) => app.getWatchlistImportWorkflow().apply(),

  // Settings and connectivity
  'set-sidebar-mode': ({ data }) => {
    if (data.sidebarOption) SidebarPreference.applyMode(data.sidebarOption);
  },
  'check-connectivity': ({ event }) => {
    event.preventDefault();
    HealthMonitor?.performHealthChecks?.();
  }
};

// Actions rendered on the home page whose behaviour lives in another delegate.
const NON_CLICK_ACTIONS = [
  'watch-status', 'watch-progress', 'mal-conflict-choice', 'personal-data-file', 'mal-watchlist-file', // change delegate
  'recommendation-ratings', 'taste-preferences', 'review-session-dismissals' // native <details> disclosures
];

// Runs the command for a clicked action element. Returns whether an action was found.
const runHomeAction = (app, element, event) => {
  const command = HOME_ACTION_COMMANDS[element?.dataset?.action];
  if (!command) return false;
  command({ app, element, event, data: element.dataset });
  return true;
};

export { HOME_ACTION_COMMANDS, NON_CLICK_ACTIONS, runHomeAction };

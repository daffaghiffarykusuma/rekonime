// @ts-nocheck
import { setHTML } from './security/trusted-types.js';
import {
  PLACEHOLDER_COVER,
  buildAiringDashboardModel,
  createAiringScheduleRuntime,
  fetchAiringSchedules,
  formatCountdownLabel,
  formatLocalDateTimeLabel
} from './airing-schedule.ts';

export {
  buildAiringDashboardModel,
  createAiringScheduleRuntime,
  fetchAiringSchedules,
  formatCountdownLabel,
  formatLocalDateTimeLabel
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeAttr = (value) => escapeHtml(value);

const renderSummaryCards = (model) => {
  if (!model || model.eligibleEntries === 0) return '';
  return `
    <div class="airing-summary-card">
      <span class="airing-summary-value">${escapeHtml(String(model.counts.availableNow))}</span>
      <span class="airing-summary-label">ready right now</span>
    </div>
    <div class="airing-summary-card">
      <span class="airing-summary-value">${escapeHtml(String(model.counts.airingToday))}</span>
      <span class="airing-summary-label">landing today</span>
    </div>
    <div class="airing-summary-card">
      <span class="airing-summary-value">${escapeHtml(model.nextUpLabel)}</span>
      <span class="airing-summary-label">next countdown</span>
    </div>
  `;
};

const renderAiringCards = (items) => {
  return items.map((item) => `
    <article class="airing-card" data-action="open-anime" data-anime-id="${escapeAttr(item.id)}" role="button" tabindex="0"
      aria-label="Open details for ${escapeAttr(item.title)}">
      <div class="airing-card-media">
        <img class="airing-card-cover" src="${escapeAttr(item.cover)}" data-fallback-src="${escapeAttr(PLACEHOLDER_COVER)}"
          alt="${escapeAttr(item.title)}" loading="lazy" decoding="async" width="96" height="144">
      </div>
      <div class="airing-card-body">
        <div class="airing-card-topline">
          <span class="airing-card-badge is-${escapeAttr(item.badge.tone)}">${escapeHtml(item.badge.label)}</span>
          <span class="airing-card-countdown">${escapeHtml(item.countdownLabel)}</span>
        </div>
        <h3 class="airing-card-title">${escapeHtml(item.title)}</h3>
        <p class="airing-card-time">${escapeHtml(item.airDateLabel)}</p>
        <div class="airing-card-meta">
          <span>${escapeHtml(item.watchStatusLabel)}</span>
          <span>${escapeHtml(item.episodeLabel)}</span>
        </div>
        <p class="airing-card-footnote">${escapeHtml(item.readinessLabel)}</p>
      </div>
    </article>
  `).join('');
};

const setSectionVisibility = (section, visible) => {
  if (!section) return;
  section.hidden = !visible;
  section.classList.toggle('is-hidden', !visible);
};

export const createAiringDashboardController = ({
  sectionId = 'airing-dashboard-section',
  subtitleId = 'airing-dashboard-subtitle',
  summaryId = 'airing-dashboard-summary',
  gridId = 'airing-dashboard-grid',
  emptyId = 'airing-dashboard-empty',
  hideWhenNoEntries = true
} = {}) => {
  const section = typeof document !== 'undefined' ? document.getElementById(sectionId) : null;
  const subtitle = typeof document !== 'undefined' ? document.getElementById(subtitleId) : null;
  const summary = typeof document !== 'undefined' ? document.getElementById(summaryId) : null;
  const grid = typeof document !== 'undefined' ? document.getElementById(gridId) : null;
  const empty = typeof document !== 'undefined' ? document.getElementById(emptyId) : null;

  if (!section || !summary || !grid || !empty) {
    return {
      showLoading() {},
      async update() {},
      destroy() {}
    };
  }

  const render = (model) => {
    if (!model || (hideWhenNoEntries && model.eligibleEntries === 0)) {
      setSectionVisibility(section, false);
      setHTML(summary, '');
      setHTML(grid, '');
      empty.hidden = true;
      return;
    }

    setSectionVisibility(section, true);
    if (subtitle) {
      subtitle.textContent = model.subtitle;
    }
    setHTML(summary, renderSummaryCards(model));
    setHTML(grid, renderAiringCards(model.items));

    const hasItems = model.items.length > 0;
    empty.hidden = hasItems;
    if (!hasItems) {
      empty.textContent = 'Nothing from your watchlist is airing right now.';
    }
  };

  const scheduleRuntime = createAiringScheduleRuntime({
    onModel: render,
    setIntervalFn: window.setInterval.bind(window),
    clearIntervalFn: window.clearInterval.bind(window)
  });

  return {
    showLoading(entryCount = 0) {
      if (!entryCount && hideWhenNoEntries) {
        setSectionVisibility(section, false);
        return;
      }
      setSectionVisibility(section, true);
      if (subtitle) {
        subtitle.textContent = 'Checking the live episode schedule. Times will match your local time.';
      }
      setHTML(summary, `
        <div class="airing-summary-card is-loading">
          <span class="airing-summary-value">Syncing</span>
          <span class="airing-summary-label">Checking live release windows</span>
        </div>
      `);
      setHTML(grid, '');
      empty.hidden = true;
    },

    async update({ entries, animeItems, locale, timeZone } = {}) {
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      const normalizedAnimeItems = Array.isArray(animeItems) ? animeItems : [];
      if (!normalizedEntries.length && hideWhenNoEntries) {
        render({
          eligibleEntries: 0,
          items: [],
          counts: { availableNow: 0, airingToday: 0, tracking: 0 },
          nextUpLabel: 'No upcoming releases',
          subtitle: 'Times shown in your local time.'
        });
        return;
      }

      this.showLoading(normalizedEntries.length);
      await scheduleRuntime.update({
        entries: normalizedEntries,
        animeItems: normalizedAnimeItems,
        locale,
        timeZone
      });
    },

    destroy() {
      scheduleRuntime.destroy();
    }
  };
};

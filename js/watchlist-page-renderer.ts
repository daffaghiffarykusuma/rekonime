// @ts-nocheck
import { buildWatchlistDisplayModel } from './watchlist-state.js';
import {
  createWatchlistControlsElement,
  getEpisodeCountFromItem
} from './watchlist-entry-presentation.ts';
import { setHTML } from './security/trusted-types.js';

const WATCHLIST_FILTERS = [
  { key: 'all', label: 'All titles' },
  { key: 'planned', label: 'Want to watch' },
  { key: 'watching', label: 'Watching now' },
  { key: 'completed', label: 'Finished' },
  { key: 'dropped', label: 'Stopped' }
];

const createWatchlistPageRenderer = ({
  buildProxyUrl,
  cardDimensions,
  documentRef = typeof document !== 'undefined' ? document : null,
  getCurrentFilter,
  getWatchlistState,
  migrateLegacyBookmarksToWatchlist,
  placeholderCover,
  sanitizeImageUrl,
  saveWatchlistMap,
  scheduleAiringDashboardUpdate
}) => {
  const renderWatchlistFilters = (counts) => {
    const container = documentRef?.getElementById('watchlist-filter-chips');
    if (!container) return;

    setHTML(container, WATCHLIST_FILTERS.map((filter) => {
      const isActive = getCurrentFilter() === filter.key;
      const count = Number.isFinite(counts[filter.key]) ? counts[filter.key] : 0;
      return `
        <button class="watchlist-filter-chip ${isActive ? 'is-active' : ''}" type="button"
          data-filter="${filter.key}" role="tab" aria-selected="${isActive ? 'true' : 'false'}">
          <span class="chip-label">${filter.label}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    }).join(''));
  };

  const getDisplayItemForEntry = (entry) => {
    return buildWatchlistDisplayModel([entry], [], { placeholder: placeholderCover }).displayItems[0];
  };

  const buildCard = (item, index, watchEntry) => {
    const card = documentRef.createElement('div');
    card.className = 'anime-card';
    card.setAttribute('data-action', 'open-anime');
    card.setAttribute('data-anime-id', item.id);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `View details for ${item.title}`);

    const media = documentRef.createElement('div');
    media.className = 'card-media';

    const img = documentRef.createElement('img');
    img.className = 'card-cover';
    img.alt = item.title;
    img.width = cardDimensions.width;
    img.height = cardDimensions.height;
    const proxyUrl = buildProxyUrl(item.cover);
    const fallbackSrc = sanitizeImageUrl(item.cover);
    img.src = proxyUrl || fallbackSrc || placeholderCover;
    if (fallbackSrc && proxyUrl) {
      img.dataset.fallbackSrc = fallbackSrc;
      img.dataset.fallbackSecondary = placeholderCover;
    } else {
      img.dataset.fallbackSrc = placeholderCover;
    }
    const eager = index < 2;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.setAttribute('fetchpriority', index === 0 ? 'high' : (eager ? 'auto' : 'low'));

    media.appendChild(img);
    card.appendChild(media);

    const body = documentRef.createElement('div');
    body.className = 'card-body';
    const title = documentRef.createElement('h3');
    title.className = 'card-title';
    title.textContent = item.title;
    const meta = documentRef.createElement('div');
    meta.className = 'card-year';
    const year = item.year ? String(item.year) : 'Unknown';
    const studio = item.studio || 'Unknown';
    meta.textContent = `${year} • ${studio}`;
    body.appendChild(title);
    body.appendChild(meta);

    const episodeCount = getEpisodeCountFromItem(item);
    if (episodeCount) {
      card.dataset.episodeCount = String(episodeCount);
    }
    body.appendChild(createWatchlistControlsElement(item, watchEntry));

    card.appendChild(body);
    return card;
  };

  const ensureWatchlistSnapshots = (map, version) => {
    let changed = false;
    map.forEach((entry, id) => {
      if (entry?.snapshot) return;
      const fallback = getDisplayItemForEntry(entry);
      if (!fallback || !fallback.id) return;
      entry.snapshot = { ...fallback };
      map.set(id, entry);
      changed = true;
    });

    if (changed) {
      saveWatchlistMap(map, version);
    }
  };

  const renderWatchlist = () => {
    const section = documentRef?.getElementById('watchlist-section');
    const grid = documentRef?.getElementById('watchlist-grid');
    const empty = documentRef?.getElementById('watchlist-empty');
    if (!section || !grid || !empty) return false;

    migrateLegacyBookmarksToWatchlist();
    const { map: watchlistMap, entries, version } = getWatchlistState();

    if (!entries.length) {
      section.classList.add('is-empty');
      grid.replaceChildren();
      scheduleAiringDashboardUpdate([], [], { timeout: 1200 });
      return true;
    }

    section.classList.remove('is-empty');
    ensureWatchlistSnapshots(watchlistMap, version);
    const model = buildWatchlistDisplayModel(entries, [], {
      statusFilter: getCurrentFilter(),
      placeholder: placeholderCover
    });
    renderWatchlistFilters(model.counts);
    scheduleAiringDashboardUpdate(entries, model.allDisplayItems, { timeout: 1800 });

    const fragment = documentRef.createDocumentFragment();
    model.visibleEntries.forEach((entry, index) => {
      const item = model.displayItems[index];
      fragment.appendChild(buildCard(item, index, entry));
    });
    grid.replaceChildren(fragment);
    return true;
  };

  return {
    buildCard,
    ensureWatchlistSnapshots,
    renderWatchlist,
    renderWatchlistFilters
  };
};

export { createWatchlistPageRenderer };

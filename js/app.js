/**
 * Main application logic for Anime Scoring Dashboard
 */

const App = {
  animeData: [],
  filteredData: [],
  currentSort: 'retention',
  filterPanelOpen: false,
  currentAnimeId: null,
  siteName: 'Rekonime',
  preferredHomePath: '/home',
  basePageUrl: '',
  embeddedDataPromise: null,
  dataSources: {
    preview: 'data/anime.preview.json',
    full: 'data/anime.full.json',
    legacy: 'data/anime.json'
  },
  isFullDataLoaded: false,
  loadingFullCatalog: false,
  fullCatalogPromise: null,
  defaultMeta: {
    title: '',
    description: '',
    image: '',
    url: ''
  },
  trailerObserver: null,
  trailerScrollHandler: null,
  trailerScrollRoot: null,
  bookmarkStorageKey: 'rekonime.bookmarks',
  bookmarkIds: [],
  bookmarkIdSet: new Set(),
  seoInitialized: false,
  urlFiltersApplied: false,
  filterQueryMap: {
    seasonYear: 'season',
    year: 'year',
    studio: 'studio',
    source: 'source',
    genres: 'genre',
    themes: 'theme',
    demographic: 'demographic'
  },
  filterTypeLabels: {
    genres: 'Genre',
    themes: 'Theme',
    demographic: 'Demographic',
    seasonYear: 'Season',
    year: 'Year',
    studio: 'Studio',
    source: 'Source'
  },
  quickFilterState: {
    genres: { expanded: false },
    themes: { expanded: false }
  },

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        default: return char;
      }
    });
  },

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#96;');
  },

  escapeCssValue(value) {
    const raw = String(value ?? '');
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(raw);
    }
    return raw.replace(/["\\]/g, '\\$&');
  },

  sanitizeUrl(rawUrl, { allowRelative = true } = {}) {
    if (!rawUrl) return '';
    const value = String(rawUrl).trim();
    if (!value) return '';

    const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
    if (!hasScheme) {
      return allowRelative ? value : '';
    }

    try {
      const parsed = new URL(value, window.location.href);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.toString();
    } catch (error) {
      return '';
    }
  },

  getAssetPath(path) {
    if (!path) return '';
    if (window.location.protocol === 'file:') {
      return path;
    }
    return path.startsWith('/') ? path : `/${path}`;
  },

  shouldUseHomeAlias() {
    if (!this.preferredHomePath) return false;
    if (window.location.protocol === 'file:') return false;
    const hostname = window.location.hostname || '';
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
    return !localHosts.has(hostname);
  },

  normalizeHomePath(url) {
    if (!this.shouldUseHomeAlias() || !url || !this.isCatalogPage()) return;
    const homePath = this.preferredHomePath.startsWith('/') ? this.preferredHomePath : `/${this.preferredHomePath}`;
    const path = url.pathname || '/';

    if (path.endsWith('/index.html')) {
      url.pathname = path.replace(/\/index\.html$/, homePath);
      return;
    }

    if (path.endsWith('/') && !path.endsWith(`${homePath}/`) && !path.endsWith(homePath)) {
      url.pathname = `${path.replace(/\/$/, '')}${homePath}`;
    }
  },

  syncHomePath({ replace = true } = {}) {
    if (!this.shouldUseHomeAlias()) return '';
    try {
      const url = new URL(window.location.href);
      const original = url.toString();
      this.normalizeHomePath(url);
      const nextUrl = url.toString();
      if (nextUrl !== original) {
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method](window.history.state || {}, '', nextUrl);
      }
      return nextUrl;
    } catch (error) {
      return '';
    }
  },

  getHomeUrl(sourceUrl) {
    if (window.location.protocol === 'file:') {
      return 'index.html';
    }
    try {
      const url = new URL(sourceUrl || window.location.href);
      const homePath = this.preferredHomePath.startsWith('/') ? this.preferredHomePath : `/${this.preferredHomePath}`;
      const directory = url.pathname.endsWith('/') ? url.pathname : url.pathname.replace(/\/[^/]*$/, '/');
      url.pathname = `${directory.replace(/\/$/, '')}${homePath}`;
      url.search = '';
      url.hash = '';
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateHomeLinks() {
    if (!this.shouldUseHomeAlias()) return;
    const homeUrl = this.getHomeUrl();
    if (!homeUrl) return;
    document.querySelectorAll('[data-home-link]').forEach(link => {
      link.setAttribute('href', homeUrl);
    });
  },

  getFilterParamMap() {
    return this.filterQueryMap;
  },

  getFilterParamNames() {
    return Object.values(this.filterQueryMap);
  },

  parseFilterParamValues(values) {
    if (!Array.isArray(values)) return [];
    return values
      .flatMap(value => String(value || '').split(','))
      .map(value => value.trim())
      .filter(Boolean);
  },

  normalizeFilterValues(type, values) {
    const cleaned = Array.isArray(values) ? values : [];
    if (cleaned.length === 0) return [];

    const options = Array.isArray(this.filterOptions?.[type]) ? this.filterOptions[type] : [];
    const canonicalMap = new Map(options.map(option => [String(option).toLowerCase(), String(option)]));
    const results = [];
    const seen = new Set();

    for (const value of cleaned) {
      const raw = String(value || '').trim();
      if (!raw) continue;
      const normalized = raw.toLowerCase();
      const canonical = canonicalMap.size ? (canonicalMap.get(normalized) || raw) : raw;
      const key = canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(canonical);
    }

    return results;
  },

  getFiltersFromUrl(sourceUrl) {
    const filters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: [],
      themes: [],
      demographic: []
    };

    try {
      const url = new URL(sourceUrl || window.location.href);
      const paramMap = this.getFilterParamMap();
      Object.entries(paramMap).forEach(([type, param]) => {
        const values = this.parseFilterParamValues(url.searchParams.getAll(param));
        filters[type] = this.normalizeFilterValues(type, values);
      });
    } catch (error) {
      return filters;
    }

    return filters;
  },

  hasFilterParamsInUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      return this.getFilterParamNames().some(param => url.searchParams.has(param));
    } catch (error) {
      return false;
    }
  },

  areFiltersEqual(left, right) {
    const types = Object.keys(this.activeFilters);
    for (const type of types) {
      const a = Array.isArray(left?.[type]) ? left[type] : [];
      const b = Array.isArray(right?.[type]) ? right[type] : [];
      if (a.length !== b.length) return false;
      const setA = new Set(a.map(value => String(value).toLowerCase()));
      for (const value of b) {
        if (!setA.has(String(value).toLowerCase())) return false;
      }
    }
    return true;
  },

  setActiveFiltersFromUrl({ updateUi = false } = {}) {
    const nextFilters = this.getFiltersFromUrl();
    const changed = !this.areFiltersEqual(this.activeFilters, nextFilters);
    this.activeFilters = nextFilters;
    if (updateUi) {
      this.renderFilterPanel();
      this.renderQuickFilters();
    }
    return changed;
  },

  getSortedFilterValues(type, values) {
    const cleaned = Array.isArray(values) ? values.map(value => String(value)) : [];
    const unique = [...new Set(cleaned)];
    const options = Array.isArray(this.filterOptions?.[type]) ? this.filterOptions[type] : [];
    if (options.length === 0) {
      return unique.sort((a, b) => a.localeCompare(b));
    }
    const order = new Map(options.map((option, index) => [String(option), index]));
    return unique.sort((a, b) => {
      const orderA = order.has(a) ? order.get(a) : Number.POSITIVE_INFINITY;
      const orderB = order.has(b) ? order.get(b) : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  },

  setFiltersOnUrl(url, filters) {
    if (!url) return;
    const paramMap = this.getFilterParamMap();
    Object.values(paramMap).forEach(param => url.searchParams.delete(param));
    Object.entries(paramMap).forEach(([type, param]) => {
      const values = this.getSortedFilterValues(type, filters?.[type] || []);
      values.forEach(value => url.searchParams.append(param, value));
    });
  },

  buildFilterStateUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      this.normalizeHomePath(url);
      this.setFiltersOnUrl(url, this.activeFilters);
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateUrlForFilters({ replace = false } = {}) {
    if (!this.isCatalogPage()) return '';
    try {
      const url = new URL(window.location.href);
      this.normalizeHomePath(url);
      this.setFiltersOnUrl(url, this.activeFilters);
      const nextUrl = url.toString();
      if (nextUrl === window.location.href) {
        return nextUrl;
      }
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method](window.history.state || {}, '', nextUrl);
      this.setCanonicalUrl(this.buildCanonicalUrl(nextUrl));
      return nextUrl;
    } catch (error) {
      return '';
    }
  },

  getActiveFilterGroups() {
    const groups = [];
    Object.entries(this.activeFilters).forEach(([type, values]) => {
      const cleaned = values
        .map(value => String(value ?? '').trim())
        .filter(Boolean);
      if (cleaned.length === 0) return;
      groups.push({
        type,
        label: this.filterTypeLabels[type] || type,
        values: cleaned
      });
    });
    return groups;
  },

  buildFilterMeta() {
    const groups = this.getActiveFilterGroups();
    const summary = groups.map(group => `${group.label}: ${group.values.join(', ')}`);
    const headline = summary.join(' | ');
    const title = headline ? `${headline} | ${this.siteName}` : this.defaultMeta.title || this.siteName;
    const prefix = headline ? `Anime filtered by ${summary.join(', ')}.` : '';
    const baseDescription = this.defaultMeta.description || '';
    const description = this.buildMetaDescription(`${prefix} ${baseDescription}`.trim());
    return { title, description };
  },

  updateMetaForFilters() {
    if (!this.seoInitialized || this.currentAnimeId) return;
    const hasFilters = this.getActiveFilterGroups().length > 0;
    if (!hasFilters) {
      this.resetMetaToDefault();
      return;
    }

    const { title, description } = this.buildFilterMeta();
    const url = this.buildCanonicalUrl(this.buildFilterStateUrl());
    this.applyMetaTags({
      title,
      description: description || this.defaultMeta.description,
      image: this.defaultMeta.image,
      url,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title,
      description: description || this.defaultMeta.description,
      url,
      image: this.defaultMeta.image
    });
  },

  isCatalogPage() {
    return Boolean(document.getElementById('catalog-section'));
  },

  getBookmarkStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  },

  loadBookmarks() {
    this.bookmarkIds = [];
    this.bookmarkIdSet = new Set();

    if (typeof window === 'undefined') return;
    const storage = this.getBookmarkStorage();
    if (!storage) return;

    try {
      const raw = storage.getItem(this.bookmarkStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const unique = [];
      const seen = new Set();
      for (const item of parsed) {
        const key = String(item ?? '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(key);
      }

      this.bookmarkIds = unique;
      this.bookmarkIdSet = new Set(unique);
    } catch (error) {
      this.bookmarkIds = [];
      this.bookmarkIdSet = new Set();
    }
  },

  saveBookmarks() {
    if (typeof window === 'undefined') return;
    const storage = this.getBookmarkStorage();
    if (!storage) return;
    try {
      storage.setItem(this.bookmarkStorageKey, JSON.stringify(this.bookmarkIds));
    } catch (error) {
      // Ignore storage errors (private mode, quota, etc.)
    }
  },

  isBookmarked(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key) return false;
    return this.bookmarkIdSet.has(key);
  },

  addBookmark(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key || this.bookmarkIdSet.has(key)) return false;
    this.bookmarkIdSet.add(key);
    this.bookmarkIds.unshift(key);
    this.saveBookmarks();
    return true;
  },

  removeBookmark(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key || !this.bookmarkIdSet.has(key)) return false;
    this.bookmarkIdSet.delete(key);
    this.bookmarkIds = this.bookmarkIds.filter(id => id !== key);
    this.saveBookmarks();
    return true;
  },

  toggleBookmark(animeId) {
    const key = String(animeId ?? '').trim();
    if (!key) return;

    if (this.isBookmarked(key)) {
      this.removeBookmark(key);
    } else {
      this.addBookmark(key);
    }

    this.updateBookmarkToggle(key);
    this.renderBookmarks();
  },

  updateBookmarkToggle(animeId) {
    const button = document.getElementById('bookmark-toggle');
    if (!button) return;

    const key = String(animeId ?? '').trim();
    if (!key) {
      button.dataset.animeId = '';
      button.classList.remove('is-bookmarked');
      button.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-label', 'Add bookmark');
      button.setAttribute('title', 'Add bookmark');
      return;
    }

    const isActive = this.isBookmarked(key);
    button.dataset.animeId = key;
    button.classList.toggle('is-bookmarked', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('aria-label', isActive ? 'Remove bookmark' : 'Add bookmark');
    button.setAttribute('title', isActive ? 'Remove bookmark' : 'Add bookmark');
  },

  getBookmarkedAnime() {
    if (!Array.isArray(this.animeData) || this.animeData.length === 0) return [];
    if (this.bookmarkIds.length === 0) return [];

    const lookup = new Map(this.animeData.map(anime => [String(anime.id), anime]));
    const results = [];

    for (const id of this.bookmarkIds) {
      const anime = lookup.get(id);
      if (anime) {
        results.push(anime);
      }
    }

    return results;
  },

  renderBookmarks() {
    const section = document.getElementById('bookmarks-section');
    const grid = document.getElementById('bookmarks-grid');
    const empty = document.getElementById('bookmarks-empty');
    if (!section || !grid || !empty) return;

    const bookmarks = this.getBookmarkedAnime();
    if (bookmarks.length === 0) {
      section.classList.add('is-empty');
      grid.innerHTML = '';
      return;
    }

    section.classList.remove('is-empty');
    grid.innerHTML = this.renderAnimeCards(bookmarks, { showBookmarkToggle: true });
  },

  // Pagination state
  gridPageSize: 24,
  gridCurrentPage: 1,
  gridRenderedCount: 0,
  gridSortedCache: null,
  gridSortedKey: '',
  gridSortedSource: null,

  // Active filters state
  activeFilters: {
    seasonYear: [],
    year: [],
    studio: [],
    source: [],
    genres: [],
    themes: [],
    demographic: []
  },

  // Filter options (populated from data)
  filterOptions: {
    seasonYear: [],
    year: [],
    studio: [],
    source: [],
    genres: [],
    themes: [],
    demographic: []
  },

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.syncHomePath();
      this.renderLoadingState();
      this.loadBookmarks();

      const requestedAnimeId = this.getAnimeIdFromUrl();
      if (requestedAnimeId) {
        const loaded = await this.loadFullCatalog();
        if (!loaded) {
          throw new Error('Failed to load full catalog');
        }
      } else {
        const loaded = await this.loadInitialData();
        if (!loaded) {
          throw new Error('Failed to load catalog');
        }
      }

      this.setupEventListeners();
      this.initSeo();
      this.updateHomeLinks();
      this.syncModalWithUrl();
      this.updateMetaForFilters();

      if (!requestedAnimeId && !this.isFullDataLoaded) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => this.loadFullCatalog(), { timeout: 1500 });
        } else {
          setTimeout(() => this.loadFullCatalog(), 0);
        }
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('We couldn\'t load the catalog. Try refreshing - if it persists, the data might be updating.');
    }
  },


  /**
   * Update sort dropdown options
   */
  updateSortOptions() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    const options = Recommendations.getSortOptions();
    select.innerHTML = options.map(opt =>
      `<option value="${opt.value}">${opt.label}</option>`
    ).join('');

    if (!options.some(option => option.value === this.currentSort)) {
      this.currentSort = options[0]?.value || 'retention';
    }
    select.value = this.currentSort;
  },

  /**
   * Load preview data first for a faster first paint.
   */
  async loadInitialData() {
    if (window.location.protocol === 'file:') {
      const loaded = await this.loadEmbeddedData();
      if (!loaded) {
        return false;
      }
      this.applyCatalogPayload({ anime: this.animeData }, { isFull: true, preserveFilters: false });
      return true;
    }

    const previewPayload = await this.fetchCatalog(this.dataSources.preview);
    if (previewPayload) {
      this.applyCatalogPayload(previewPayload, { isFull: false, preserveFilters: false });
      return true;
    }

    return this.loadFullCatalog();
  },

  async loadFullCatalog() {
    if (this.isFullDataLoaded) {
      return true;
    }

    if (this.fullCatalogPromise) {
      return this.fullCatalogPromise;
    }

    this.loadingFullCatalog = true;
    this.fullCatalogPromise = (async () => {
      if (window.location.protocol === 'file:') {
        const loaded = await this.loadEmbeddedData();
        if (!loaded) {
          return false;
        }
        this.applyCatalogPayload({ anime: this.animeData }, { isFull: true, preserveFilters: true });
        return true;
      }

      const fullPayload =
        (await this.fetchCatalog(this.dataSources.full)) ||
        (await this.fetchCatalog(this.dataSources.legacy));

      if (!fullPayload) {
        const loaded = await this.loadEmbeddedData();
        if (!loaded) {
          return false;
        }
        this.applyCatalogPayload({ anime: this.animeData }, { isFull: true, preserveFilters: true });
        return true;
      }

      this.applyCatalogPayload(fullPayload, { isFull: true, preserveFilters: true });
      return true;
    })();

    const result = await this.fullCatalogPromise;
    this.isFullDataLoaded = Boolean(result);
    this.loadingFullCatalog = false;
    this.fullCatalogPromise = null;
    return result;
  },

  async fetchCatalog(path) {
    if (!path) return null;
    try {
      const response = await fetch(this.getAssetPath(path), { cache: 'force-cache' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  },

  applyCatalogPayload(payload, { isFull = false, preserveFilters = true } = {}) {
    const catalog = payload?.anime || [];
    this.scoreProfile = this.isValidScoreProfile(payload?.scoreProfile) ? payload.scoreProfile : null;
    this.animeData = this.normalizeAnimeData(catalog);
    this.isFullDataLoaded = isFull;
    this.gridSortedCache = null;
    this.gridSortedSource = null;

    if (!preserveFilters) {
      this.activeFilters = {
        seasonYear: [],
        year: [],
        studio: [],
        source: [],
        genres: [],
        themes: [],
        demographic: []
      };
    }

    this.ensureStats();
    this.extractFilterOptions();

    if (!this.urlFiltersApplied && this.isCatalogPage()) {
      const hasFilterParams = this.hasFilterParamsInUrl();
      this.setActiveFiltersFromUrl();
      this.urlFiltersApplied = true;
      if (hasFilterParams) {
        this.updateUrlForFilters({ replace: true });
      }
    }

    this.updateSortOptions();
    this.renderFilterPanel();
    this.renderQuickFilters();
    this.applyFilters({ syncUrl: false, updateMeta: false });
  },

  renderLoadingState() {
    const recommendations = document.getElementById('recommendations-grid');
    const rankings1 = document.getElementById('best-ranking-1');
    const rankings2 = document.getElementById('best-ranking-2');
    const grid = document.getElementById('anime-grid');

    if (recommendations) {
      recommendations.classList.add('is-loading');
    }

    if (grid) {
      grid.classList.add('is-loading');
    }

    if (rankings1) {
      rankings1.setAttribute('aria-busy', 'true');
    }

    if (rankings2) {
      rankings2.setAttribute('aria-busy', 'true');
    }
  },

  ensureStats() {
    const needsStats = this.animeData.some(anime => !anime.stats);
    if (!needsStats) {
      this.animeData = this.animeData.map((anime, index) => ({
        ...anime,
        colorIndex: Number.isFinite(anime.colorIndex) ? anime.colorIndex : index
      }));
      return;
    }

    const scoreProfile = this.isValidScoreProfile(this.scoreProfile)
      ? this.scoreProfile
      : Stats.buildScoreProfile(this.animeData);

    this.scoreProfile = scoreProfile;

    this.animeData = this.animeData.map((anime, index) => ({
      ...anime,
      stats: anime.stats || Stats.calculateAllStats(anime, scoreProfile),
      colorIndex: Number.isFinite(anime.colorIndex) ? anime.colorIndex : index
    }));
  },

  isValidScoreProfile(profile) {
    return Boolean(profile && Number.isFinite(profile.p35) && Number.isFinite(profile.p50) && Number.isFinite(profile.p65));
  },

  /**
   * Load embedded data only when fetch fails (keeps initial load light).
   */
  async loadEmbeddedData() {
    if (typeof ANIME_DATA !== 'undefined') {
      this.animeData = this.normalizeAnimeData(ANIME_DATA.anime || []);
      return true;
    }

    try {
      await this.loadEmbeddedDataScript();
    } catch (error) {
      return false;
    }

    if (typeof ANIME_DATA === 'undefined') {
      return false;
    }

    this.animeData = this.normalizeAnimeData(ANIME_DATA.anime || []);
    return true;
  },

  loadEmbeddedDataScript() {
    if (this.embeddedDataPromise) {
      return this.embeddedDataPromise;
    }

    this.embeddedDataPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = this.getAssetPath('js/data.js');
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load embedded anime data'));
      document.head.appendChild(script);
    });

    return this.embeddedDataPromise;
  },

  /**
   * Normalize anime data to handle both flat and nested (metadata) structures
   * This ensures compatibility with both old format and new scraper output
   */
  normalizeAnimeData(animeList) {
    return animeList.map(anime => {
      const normalizedGenres = this.sanitizeTagList(anime?.metadata?.genres || anime?.genres || []);
      const normalizedThemes = this.sanitizeTagList(anime?.metadata?.themes || anime?.themes || []);
      const normalizedTrailer = anime?.metadata?.trailer || anime?.trailer || null;
      const normalizedSynopsis = anime?.metadata?.synopsis || anime?.synopsis || '';
      const existingStats = anime?.stats || anime?.metadata?.stats || null;
      const existingColorIndex = Number.isFinite(anime?.colorIndex) ? anime.colorIndex : null;
      const existingSearchText = anime?.searchText || '';
      const normalizedTitleEnglish =
        anime?.metadata?.title_english ||
        anime?.metadata?.titleEnglish ||
        anime?.title_english ||
        anime?.titleEnglish ||
        '';
      const normalizedTitleJapanese =
        anime?.metadata?.title_japanese ||
        anime?.metadata?.titleJapanese ||
        anime?.title_japanese ||
        anime?.titleJapanese ||
        '';
      const normalizedType = anime?.metadata?.type || anime?.type || '';
      const rawCommunityScore = anime?.communityScore ?? anime?.metadata?.score ?? anime?.score;
      const communityScore = Number.isFinite(Number(rawCommunityScore)) ? Number(rawCommunityScore) : null;

      // If data has nested metadata structure, flatten it
      if (anime.metadata) {
        const resolvedTitle = anime.metadata.title || anime.title;
        return {
          id: anime.metadata.id || anime.id,
          title: resolvedTitle,
          titleEnglish: normalizedTitleEnglish,
          titleJapanese: normalizedTitleJapanese,
          malId: anime.metadata.malId || anime.mal_id || anime.malId,
          anilistId: anime.metadata.anilistId || anime.anilistId,
          cover: anime.metadata.cover || anime.cover,
          type: normalizedType,
          year: anime.metadata.year || anime.year,
          season: anime.metadata.season || anime.season,
          studio: anime.metadata.studio || anime.studio,
          source: anime.metadata.source || anime.source,
          genres: normalizedGenres,
          themes: normalizedThemes,
          demographic: anime.metadata.demographic || anime.demographic,
          trailer: normalizedTrailer,
          synopsis: normalizedSynopsis,
          communityScore: communityScore,
          searchText: existingSearchText || this.buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
          episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
          stats: existingStats,
          colorIndex: existingColorIndex
        };
      }
      // Already flat structure, ensure all fields exist
      const resolvedTitle = anime.title;
      return {
        id: anime.id,
        title: resolvedTitle,
        titleEnglish: normalizedTitleEnglish,
        titleJapanese: normalizedTitleJapanese,
        malId: anime.malId,
        anilistId: anime.anilistId,
        cover: anime.cover,
        type: normalizedType,
        year: anime.year,
        season: anime.season,
        studio: anime.studio,
        source: anime.source,
        genres: normalizedGenres,
        themes: normalizedThemes,
        demographic: anime.demographic,
        trailer: normalizedTrailer,
        synopsis: normalizedSynopsis,
        communityScore: communityScore,
        searchText: existingSearchText || this.buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
        episodes: Array.isArray(anime.episodes) ? anime.episodes : [],
        stats: existingStats,
        colorIndex: existingColorIndex
      };
    });
  },

  /**
   * Normalize tag arrays to avoid empty or undefined labels
   * @param {Array} tags - Raw tag list
   * @returns {Array} Cleaned tag list
   */
  sanitizeTagList(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const cleaned = [];

    for (const tag of tags) {
      const label = String(tag ?? '').trim();
      const normalized = label.toLowerCase();
      if (!label || normalized === 'undefined' || normalized === 'null') continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      cleaned.push(label);
    }

    return cleaned;
  },

  normalizeSearchQuery(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .trim();
  },

  buildSearchText(title, titleEnglish, titleJapanese) {
    const parts = [title, titleEnglish, titleJapanese]
      .map(value => this.normalizeSearchQuery(value))
      .filter(Boolean);
    return parts.join(' ');
  },

  /**
   * Calculate statistics for all anime
   */
  calculateAllStats() {
    const scoreProfile = Stats.buildScoreProfile(this.animeData);
    this.scoreProfile = scoreProfile;
    this.animeData = this.animeData.map((anime, index) => ({
      ...anime,
      stats: Stats.calculateAllStats(anime, scoreProfile),
      colorIndex: index
    }));
  },

  /**
   * Extract unique filter options from data
   */
  extractFilterOptions() {
    const seasonYears = new Set();
    const years = new Set();
    const studios = new Set();
    const sources = new Set();
    const genres = new Set();
    const themes = new Set();
    const demographics = new Set();

    this.animeData.forEach(anime => {
      // Generate season-year combinations
      if (anime.year && anime.season) {
        seasonYears.add(`${anime.season} ${anime.year}`);
      }
      // Extract year
      if (anime.year) {
        years.add(anime.year);
      }
      // Handle studio as string or array
      if (anime.studio) {
        if (Array.isArray(anime.studio)) {
          anime.studio.forEach(s => studios.add(s));
        } else {
          studios.add(anime.studio);
        }
      }
      if (anime.source) sources.add(anime.source);
      if (anime.genres) anime.genres.forEach(g => genres.add(g));
      if (anime.themes) anime.themes.forEach(t => themes.add(t));
      if (anime.demographic) demographics.add(anime.demographic);
    });

    // Sort season-year by year descending, then by season order
    const seasonOrder = { 'Winter': 0, 'Spring': 1, 'Summer': 2, 'Fall': 3 };
    const sortedSeasonYears = [...seasonYears].sort((a, b) => {
      const [seasonA, yearA] = a.split(' ');
      const [seasonB, yearB] = b.split(' ');
      if (yearA !== yearB) {
        return parseInt(yearB) - parseInt(yearA); // Descending year
      }
      return seasonOrder[seasonB] - seasonOrder[seasonA]; // Descending season within year
    });

    // Sort years descending (newest first)
    const sortedYears = [...years].sort((a, b) => b - a);

    this.filterOptions = {
      seasonYear: sortedSeasonYears,
      year: sortedYears,
      studio: [...studios].sort(),
      source: [...sources].sort(),
      genres: [...genres].sort(),
      themes: [...themes].sort(),
      demographic: [...demographics].sort()
    };
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Sort dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.resetGridPagination();
        this.renderAnimeGrid();
      });
    }

    // Filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => {
        this.toggleFilterPanel();
      });
    }

    // Clear all filters
    const clearFilters = document.getElementById('clear-filters');
    if (clearFilters) {
      clearFilters.addEventListener('click', () => {
        this.clearAllFilters();
      });
    }

    const clearActiveFilters = document.getElementById('active-filters-clear');
    if (clearActiveFilters) {
      clearActiveFilters.addEventListener('click', () => {
        this.clearAllFilters();
      });
    }

    // Close detail modal
    const closeDetail = document.getElementById('close-detail');
    if (closeDetail) {
      closeDetail.addEventListener('click', () => {
        this.closeDetailModal();
      });
    }

    // Click outside modal to close
    const modal = document.getElementById('detail-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeDetailModal();
        }
      });
    }

    // Filter modal close button
    const closeFilterModal = document.getElementById('close-filter-modal');
    if (closeFilterModal) {
      closeFilterModal.addEventListener('click', () => {
        this.closeFilterModal();
      });
    }

    // Click outside filter modal to close
    const filterModal = document.getElementById('filter-modal');
    if (filterModal) {
      filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) {
          this.closeFilterModal();
        }
      });
    }

    // Apply filters button
    const applyFilters = document.getElementById('apply-filters');
    if (applyFilters) {
      applyFilters.addEventListener('click', () => {
        this.closeFilterModal();
      });
    }

    window.addEventListener('popstate', () => {
      const filtersChanged = this.setActiveFiltersFromUrl({ updateUi: true });
      if (filtersChanged) {
        this.applyFilters({ syncUrl: false, updateMeta: false });
      }
      this.syncModalWithUrl({ updateUrl: false });
      this.updateMetaForFilters();
    });

    // Header search
    this.setupHeaderSearch();
    this.setupActionDelegates();
    this.setupImageFallbacks();
    this.setupFilterFab();
  },

  /**
   * Setup header search functionality
   */
  setupHeaderSearch() {
    const headerSearch = document.getElementById('header-search');
    const headerDropdown = document.getElementById('header-search-dropdown');

    if (headerSearch && headerDropdown) {
      headerSearch.addEventListener('input', (e) => {
        this.handleHeaderSearch(e.target.value);
      });

      headerSearch.addEventListener('focus', () => {
        if (headerSearch.value.length > 0) {
          headerDropdown.classList.add('visible');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search-wrapper')) {
          headerDropdown.classList.remove('visible');
        }
      });
    }
  },

  /**
   * Initialize SEO metadata and structured data defaults.
   */
  initSeo() {
    const currentTitle = document.title || this.siteName;
    const currentDescription = this.getMetaContent('description');
    const currentImage = this.getMetaContent('og:image', true);
    const syncedUrl = this.syncHomePath();
    const canonicalUrl = this.buildCanonicalUrl(syncedUrl || window.location.href);

    this.basePageUrl = this.getBaseUrl(canonicalUrl);
    this.siteName = currentTitle.split(' - ')[0] || this.siteName;

    this.defaultMeta = {
      title: currentTitle,
      description: currentDescription,
      image: currentImage,
      url: this.basePageUrl || canonicalUrl
    };

    this.applyMetaTags({
      title: currentTitle,
      description: currentDescription,
      image: currentImage,
      url: canonicalUrl,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title: currentTitle,
      description: currentDescription,
      url: canonicalUrl,
      image: currentImage
    });

    this.seoInitialized = true;
  },

  /**
   * Sync modal state to the current URL.
   */
  syncModalWithUrl({ updateUrl = true } = {}) {
    const animeId = this.getAnimeIdFromUrl();
    if (animeId) {
      if (this.currentAnimeId !== animeId) {
        this.showAnimeDetail(animeId, { updateUrl });
      }
      return;
    }

    if (this.currentAnimeId) {
      this.closeDetailModal({ updateUrl });
    }
  },

  getAnimeIdFromUrl() {
    try {
      const url = new URL(window.location.href);
      const animeId = url.searchParams.get('anime');
      return animeId ? animeId.trim() : '';
    } catch (error) {
      return '';
    }
  },

  getBaseUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      url.searchParams.delete('anime');
      this.getFilterParamNames().forEach(param => url.searchParams.delete(param));
      return this.buildCanonicalUrl(url.toString());
    } catch (error) {
      return '';
    }
  },

  buildCanonicalUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      url.hash = '';
      this.normalizeHomePath(url);
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  resolveUrl(value) {
    if (!value) return '';
    try {
      return new URL(value, window.location.href).toString();
    } catch (error) {
      return value;
    }
  },

  buildUrlForAnime(animeId) {
    try {
      const url = new URL(this.basePageUrl || window.location.href);
      this.normalizeHomePath(url);
      if (animeId) {
        url.searchParams.set('anime', animeId);
      } else {
        url.searchParams.delete('anime');
      }
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  updateUrlForAnime(animeId, { replace = false } = {}) {
    try {
      const url = new URL(window.location.href);
      const currentAnimeId = url.searchParams.get('anime');
      this.normalizeHomePath(url);

      if (animeId) {
        if (currentAnimeId === animeId && !replace) return url.toString();
        url.searchParams.set('anime', animeId);
      } else {
        if (!currentAnimeId && !replace) return url.toString();
        url.searchParams.delete('anime');
      }

      const newUrl = url.toString();
      const method = replace ? 'replaceState' : 'pushState';
      window.history[method]({ animeId: animeId || null }, '', newUrl);
      this.setCanonicalUrl(this.buildCanonicalUrl(newUrl));
      return newUrl;
    } catch (error) {
      return '';
    }
  },

  getMetaContent(key, isProperty = false) {
    const attr = isProperty ? 'property' : 'name';
    const tag = document.querySelector(`meta[${attr}="${key}"]`);
    return tag ? tag.getAttribute('content') || '' : '';
  },

  setMetaContent(key, content, isProperty = false) {
    const attr = isProperty ? 'property' : 'name';
    let tag = document.querySelector(`meta[${attr}="${key}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attr, key);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  },

  setCanonicalUrl(url) {
    if (!url) return;
    let tag = document.querySelector('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement('link');
      tag.setAttribute('rel', 'canonical');
      document.head.appendChild(tag);
    }
    tag.setAttribute('href', url);
  },

  applyMetaTags({ title, description, image, url, imageAlt } = {}) {
    const safeTitle = title || this.defaultMeta.title || this.siteName;
    const safeDescription = description || this.defaultMeta.description || '';
    const safeImage = image || this.defaultMeta.image || '';
    const safeUrl = url || this.defaultMeta.url || this.buildCanonicalUrl(window.location.href);
    const resolvedUrl = this.resolveUrl(safeUrl);
    const resolvedImage = this.resolveUrl(safeImage);
    const twitterCard = resolvedImage ? 'summary_large_image' : 'summary';

    if (safeTitle) {
      document.title = safeTitle;
      this.setMetaContent('og:title', safeTitle, true);
      this.setMetaContent('twitter:title', safeTitle);
    }

    if (safeDescription) {
      this.setMetaContent('description', safeDescription);
      this.setMetaContent('og:description', safeDescription, true);
      this.setMetaContent('twitter:description', safeDescription);
    }

    if (resolvedUrl) {
      this.setMetaContent('og:url', resolvedUrl, true);
      this.setCanonicalUrl(resolvedUrl);
    }

    this.setMetaContent('twitter:card', twitterCard);

    if (resolvedImage) {
      this.setMetaContent('og:image', resolvedImage, true);
      this.setMetaContent('twitter:image', resolvedImage);
    }

    if (imageAlt) {
      this.setMetaContent('og:image:alt', imageAlt, true);
    }
  },

  buildMetaDescription(text) {
    const cleaned = String(text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return '';
    if (cleaned.length <= 160) return cleaned;
    return `${cleaned.slice(0, 157).trim()}...`;
  },

  getSynopsisForAnime(anime) {
    if (!anime) return '';
    const synopsis = String(anime.synopsis || '').trim();
    if (synopsis) return synopsis;
    const cacheKey = anime.anilistId || anime.title;
    return ReviewsService.getCachedDescription(cacheKey);
  },

  updateMetaForAnime(anime, descriptionOverride = '') {
    if (!anime) {
      this.resetMetaToDefault();
      return;
    }

    const description = this.buildMetaDescription(descriptionOverride || anime.synopsis);
    const title = `${anime.title} | ${this.siteName}`;
    const url = this.buildCanonicalUrl(this.buildUrlForAnime(anime.id));
    const image = anime.cover || this.defaultMeta.image;

    this.applyMetaTags({
      title,
      description: description || this.defaultMeta.description,
      image,
      url,
      imageAlt: anime.title
    });

    this.updateStructuredData({
      title,
      description: description || this.defaultMeta.description,
      url,
      image
    });
  },

  resetMetaToDefault() {
    const url = this.buildCanonicalUrl(this.basePageUrl || window.location.href);
    this.applyMetaTags({
      title: this.defaultMeta.title,
      description: this.defaultMeta.description,
      image: this.defaultMeta.image,
      url,
      imageAlt: 'Rekonime logo'
    });

    this.updateStructuredData({
      title: this.defaultMeta.title,
      description: this.defaultMeta.description,
      url,
      image: this.defaultMeta.image
    });
  },

  updateStructuredData({ title, description, url, image } = {}) {
    let script = document.getElementById('structured-data');
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'structured-data';
      const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content');
      if (nonce) {
        script.setAttribute('nonce', nonce);
      }
      document.head.appendChild(script);
    }

    const pageUrl = url || this.buildCanonicalUrl(window.location.href);
    const siteUrl = this.basePageUrl || this.getBaseUrl(pageUrl) || pageUrl;
    const resolvedImage = this.resolveUrl(image);

    const data = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${siteUrl}#website`,
          'name': this.siteName,
          'url': siteUrl,
          'description': this.defaultMeta.description || description || ''
        },
        {
          '@type': 'WebPage',
          '@id': `${pageUrl}#webpage`,
          'name': title || this.defaultMeta.title || this.siteName,
          'url': pageUrl,
          'description': description || this.defaultMeta.description || '',
          'isPartOf': { '@id': `${siteUrl}#website` }
        }
      ]
    };

    if (resolvedImage) {
      data['@graph'][1].primaryImageOfPage = {
        '@type': 'ImageObject',
        'url': resolvedImage
      };
    }

    script.textContent = JSON.stringify(data);
  },

  /**
   * Handle header search input (opens anime detail)
   */
  handleHeaderSearch(query) {
    const dropdown = document.getElementById('header-search-dropdown');
    if (!dropdown) return;

    if (query.length < 2) {
      dropdown.classList.remove('visible');
      dropdown.innerHTML = '';
      return;
    }

    const queryLower = this.normalizeSearchQuery(query);
    const matches = this.animeData
      .filter(anime => {
        const haystack = anime.searchText || this.buildSearchText(anime.title, anime.titleEnglish, anime.titleJapanese);
        return haystack.includes(queryLower);
      })
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="search-no-results">No matches—try a different title</div>';
      dropdown.classList.add('visible');
      return;
    }
    dropdown.innerHTML = matches.map(anime => {
      const altTitles = [anime.titleEnglish, anime.titleJapanese]
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .filter(value => value.toLowerCase() !== anime.title.toLowerCase());
      const safeAltTitles = altTitles.map(value => this.escapeHtml(value));
      const altTitleMarkup = altTitles.length
        ? `<div class="search-result-alt">${safeAltTitles.join(' • ')}</div>`
        : '';
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeCover = this.escapeAttr(this.sanitizeUrl(anime.cover));
      const safeYear = this.escapeHtml(anime.year ?? 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio ?? 'Unknown');
      return `
      <div class="search-result-item" data-action="open-anime" data-anime-id="${safeId}">
        <img src="${safeCover}" alt="${safeTitle}" class="search-result-cover" data-fallback-src="https://via.placeholder.com/40x56?text=No">
        <div class="search-result-info">
          <div class="search-result-title">${safeTitle}</div>
          ${altTitleMarkup}
          <div class="search-result-meta">${safeYear} &bull; ${safeStudio}</div>
        </div>
      </div>
    `;
    }).join('');

    dropdown.classList.add('visible');
  },

  /**
   * Toggle filter panel visibility
   */
  toggleFilterPanel() {
    const modal = document.getElementById('filter-modal');
    if (modal) {
      this.filterPanelOpen = !this.filterPanelOpen;
      modal.classList.toggle('visible', this.filterPanelOpen);
      document.body.style.overflow = this.filterPanelOpen ? 'hidden' : '';
      if (this.filterPanelOpen) {
        const content = modal.querySelector('.filter-modal-content');
        if (content) {
          content.scrollTop = 0;
        }
      }
    }
  },

  closeFilterModal() {
    const modal = document.getElementById('filter-modal');
    if (modal) {
      this.filterPanelOpen = false;
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    }
  },

  /**
   * Render filter panel with all options
   */
  renderFilterPanel() {
    const container = document.getElementById('filter-sections');
    if (!container) return;

    const filterConfig = [
      { key: 'genres', label: 'Genres' },
      { key: 'themes', label: 'Themes' },
      { key: 'demographic', label: 'Demographic' },
      { key: 'seasonYear', label: 'Season' },
      { key: 'year', label: 'Year' },
      { key: 'studio', label: 'Studios' },
      { key: 'source', label: 'Source' }
    ];

    container.innerHTML = filterConfig.map(config => {
      const options = this.filterOptions[config.key];
      if (!options || options.length === 0) return '';

      const safeLabel = this.escapeHtml(config.label);
      const safeType = this.escapeAttr(config.key);

      return `
        <div class="filter-section">
          <div class="filter-section-title">${safeLabel}</div>
          <div class="filter-pills">
            ${options.map(option => {
              const optionStr = String(option);
              const isActive = this.activeFilters[config.key].includes(optionStr) || this.activeFilters[config.key].includes(option);
              const safeOptionText = this.escapeHtml(optionStr);
              const safeOptionAttr = this.escapeAttr(optionStr);
              return `
              <button class="filter-pill ${isActive ? 'active' : ''}"
                      data-action="toggle-filter"
                      data-filter-type="${safeType}"
                      data-filter-value="${safeOptionAttr}">
                ${safeOptionText}
              </button>
            `}).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render quick filter chips (genre & theme)
   */
  renderQuickFilters() {
    const genreContainer = document.getElementById('genre-chips');
    const themeContainer = document.getElementById('theme-chips');
    const isMobile = window.matchMedia?.('(max-width: 640px)')?.matches;
    const genreCount = Array.isArray(this.filterOptions.genres) ? this.filterOptions.genres.length : 0;
    const themeBase = isMobile ? (genreCount || 12) : Number.POSITIVE_INFINITY;
    const limits = {
      genres: Number.POSITIVE_INFINITY,
      themes: themeBase
    };

    const renderGroup = (type, options, container) => {
      if (!container || !options || options.length === 0) return;
      const limit = limits[type] || 12;
      const state = this.quickFilterState[type] || { expanded: false };
      const expanded = type === 'genres' ? true : state.expanded;

      const chipsMarkup = options.map((option, index) => {
        const optionStr = String(option);
        const isActive = this.activeFilters[type].includes(optionStr) || this.activeFilters[type].includes(option);
        const safeText = this.escapeHtml(optionStr);
        const safeAttr = this.escapeAttr(optionStr);
        const isHidden = !expanded && index >= limit && !isActive;
        return `
          <button class="quick-chip ${isActive ? 'active' : ''} ${isHidden ? 'is-hidden' : ''}"
                  data-action="toggle-filter"
                  data-filter-type="${type}"
                  data-filter-value="${safeAttr}">
            ${safeText}
          </button>
        `;
      }).join('');

      const showToggle = type !== 'genres' && options.length > limit && Number.isFinite(limit);
      const hiddenCount = Math.max(options.length - limit, 0);
      const toggleLabel = expanded ? 'Show less' : `Show ${hiddenCount} more`;
      const toggleMarkup = showToggle
        ? `
          <button class="quick-more" type="button" data-action="toggle-quick-more" data-filter-type="${type}">
            ${toggleLabel}
          </button>
        `
        : '';

      container.innerHTML = `${chipsMarkup}${toggleMarkup}`;
    };

    renderGroup('genres', this.filterOptions.genres, genreContainer);
    renderGroup('themes', this.filterOptions.themes, themeContainer);
  },

  /**
   * Toggle a filter on/off
   */
  toggleFilter(type, value) {
    const valueStr = String(value);
    const index = this.activeFilters[type].indexOf(valueStr);
    if (index > -1) {
      this.activeFilters[type].splice(index, 1);
    } else {
      this.activeFilters[type].push(valueStr);
    }

    // Update pill state in modal
    const safeType = this.escapeCssValue(type);
    const pillCandidates = document.querySelectorAll(`.filter-pill[data-filter-type="${safeType}"]`);
    const pill = Array.from(pillCandidates).find(el => el.dataset.filterValue === valueStr);
    if (pill) {
      pill.classList.toggle('active');
    }

    // Update quick chip state
    const chipCandidates = document.querySelectorAll(`.quick-chip[data-filter-type="${safeType}"]`);
    const chip = Array.from(chipCandidates).find(el => el.dataset.filterValue === valueStr);
    if (chip) {
      chip.classList.toggle('active');
    }

    this.applyFilters();
  },

  /**
   * Count total active filters across all filter groups.
   * @returns {number} Active filter count
   */
  getActiveFilterCount() {
    return Object.values(this.activeFilters).reduce((total, values) => {
      if (!Array.isArray(values)) return total;
      return total + values.filter(value => value !== null && value !== undefined && value !== '').length;
    }, 0);
  },

  /**
   * Smoothly scroll to results after quick filter actions.
   */
  scrollToResultsSection() {
    const shouldScroll = window.matchMedia?.('(max-width: 640px)')?.matches;
    if (!shouldScroll) return;
    const target =
      document.getElementById('recommendations-section') ||
      document.getElementById('catalog-section');
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  },

  /**
   * Scroll back to the quick filters section.
   */
  scrollToFiltersSection() {
    const target = document.getElementById('quick-filters');
    if (!target) return;
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    target.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  },

  /**
   * Show/hide the filter jump button on mobile.
   */
  setupFilterFab() {
    const button = document.getElementById('filter-fab');
    if (!button) return;
    const isMobileQuery = window.matchMedia?.('(max-width: 640px)');
    const updateVisibility = () => {
      const isMobile = isMobileQuery ? isMobileQuery.matches : window.innerWidth <= 640;
      if (!isMobile) {
        button.classList.remove('is-visible');
        return;
      }
      const showAfter = 320;
      button.classList.toggle('is-visible', window.scrollY > showAfter);
    };
    updateVisibility();
    window.addEventListener('scroll', updateVisibility, { passive: true });
    if (isMobileQuery?.addEventListener) {
      isMobileQuery.addEventListener('change', updateVisibility);
    }
  },

  /**
   * Clear all active filters
   */
  clearAllFilters() {
    this.activeFilters = {
      seasonYear: [],
      year: [],
      studio: [],
      source: [],
      genres: [],
      themes: [],
      demographic: []
    };

    // Update all pills and quick chips
    document.querySelectorAll('.filter-pill.active, .quick-chip.active').forEach(el => {
      el.classList.remove('active');
    });

    this.applyFilters();
  },

  /**
   * Apply all active filters to data
   */
  applyFilters({ syncUrl = true, replaceUrl = false, updateMeta = true } = {}) {
    this.filteredData = this.animeData.filter(anime => {
      // Check season-year filter
      if (this.activeFilters.seasonYear.length > 0) {
        const animeSeasonYear = `${anime.season} ${anime.year}`;
        if (!this.activeFilters.seasonYear.includes(animeSeasonYear)) {
          return false;
        }
      }

      // Check year filter (independent of season)
      if (this.activeFilters.year.length > 0) {
        // Compare as strings since filter values are stored as strings
        if (!this.activeFilters.year.includes(String(anime.year))) {
          return false;
        }
      }

      // Check studio filter (OR logic within category, handle array studios)
      if (this.activeFilters.studio.length > 0) {
        const animeStudios = Array.isArray(anime.studio) ? anime.studio : [anime.studio];
        const hasMatchingStudio = animeStudios.some(s => this.activeFilters.studio.includes(s));
        if (!hasMatchingStudio) {
          return false;
        }
      }

      // Check source filter
      if (this.activeFilters.source.length > 0) {
        if (!this.activeFilters.source.includes(anime.source)) {
          return false;
        }
      }

      // Check genres filter (anime must have ALL of the selected genres)
      if (this.activeFilters.genres.length > 0) {
        const hasAllGenres = anime.genres &&
          this.activeFilters.genres.every(g => anime.genres.includes(g));
        if (!hasAllGenres) {
          return false;
        }
      }

      // Check themes filter (anime must have ALL of the selected themes)
      if (this.activeFilters.themes.length > 0) {
        const hasAllThemes = anime.themes &&
          this.activeFilters.themes.every(t => anime.themes.includes(t));
        if (!hasAllThemes) {
          return false;
        }
      }

      // Check demographic filter
      if (this.activeFilters.demographic.length > 0) {
        if (!this.activeFilters.demographic.includes(anime.demographic)) {
          return false;
        }
      }

      return true;
    });

    // Reset pagination when filters change
    this.resetGridPagination();
    if (syncUrl) {
      this.updateUrlForFilters({ replace: replaceUrl });
    }
    this.render();
    if (updateMeta) {
      this.updateMetaForFilters();
    }
  },

  /**
   * Render the entire dashboard
   */
  render() {
    this.renderActiveFilters();
    this.renderBookmarks();
    this.renderRankings();
    this.renderRecommendations();
    this.renderAnimeGrid();
  },

  /**
   * Get cached sorted data for the grid
   */
  getSortedGridData() {
    if (this.gridSortedCache &&
        this.gridSortedKey === this.currentSort &&
        this.gridSortedSource === this.filteredData) {
      return this.gridSortedCache;
    }

    const sorted = this.sortAnimeByMetric(this.filteredData, this.currentSort);
    this.gridSortedCache = sorted;
    this.gridSortedKey = this.currentSort;
    this.gridSortedSource = this.filteredData;
    return sorted;
  },

  /**
   * Render anime cards HTML
   */
  renderAnimeCards(animeList, { showBookmarkToggle = false } = {}) {
    return animeList.map((anime) => {
      const badges = Recommendations.getBadges(anime);
      const cardStats = Recommendations.getCardStats(anime);
      const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
      const retentionLevel = hasEpisodes ? Math.round(anime.stats.retentionScore) : 0;
      const reason = Recommendations.getRecommendationReason(anime);
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeCover = this.escapeAttr(this.sanitizeUrl(anime.cover));
      const safeYear = this.escapeHtml(anime.year || 'Unknown');
      const safeStudio = this.escapeHtml(anime.studio || 'Unknown');
      const safeReason = this.escapeHtml(reason);
      const isBookmarked = this.isBookmarked(anime.id);
      const bookmarkLabel = isBookmarked ? 'Remove bookmark' : 'Add bookmark';

      return `
        <div class="anime-card"
             data-action="open-anime"
             data-anime-id="${safeId}">
          <div class="card-media">
            <img src="${safeCover}" alt="${safeTitle}" class="card-cover" loading="lazy" data-fallback-src="https://via.placeholder.com/120x170?text=No+Image">
            ${showBookmarkToggle ? `
              <button class="bookmark-card-toggle ${isBookmarked ? 'is-bookmarked' : ''}"
                      type="button"
                      data-action="toggle-bookmark"
                      data-anime-id="${safeId}"
                      aria-label="${bookmarkLabel}"
                      title="${bookmarkLabel}">
                &#9733;
              </button>
            ` : ''}
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h3 class="card-title">${safeTitle}</h3>
            </div>
            <div class="card-year">${safeYear} &bull; ${safeStudio}</div>
            ${badges.length > 0 ? `
              <div class="card-badges">
                ${badges.map(b => `<span class="card-badge ${b.class}">${this.escapeHtml(b.label)}</span>`).join('')}
              </div>
            ` : ''}
            <div class="card-stats">
              ${cardStats.map(stat => {
                const safeValue = this.escapeHtml(stat.value);
                const safeSuffix = this.escapeHtml(stat.suffix || '');
                const safeLabel = this.escapeHtml(stat.label);
                const safeTooltipTitle = stat.tooltip ? this.escapeHtml(stat.tooltip.title) : '';
                const safeTooltipText = stat.tooltip ? this.escapeHtml(stat.tooltip.text) : '';
                return `
                <div class="stat ${stat.tooltip ? 'has-tooltip' : ''}" ${stat.tooltip ? 'tabindex="0"' : ''}>
                  <span class="stat-value ${stat.class || ''}">${safeValue}${safeSuffix}</span>
                  <span class="stat-label">${safeLabel}</span>
                  ${stat.tooltip ? `
                    <div class="tooltip tooltip--bottom" role="tooltip">
                      <div class="tooltip-title">${safeTooltipTitle}</div>
                      <div class="tooltip-text">${safeTooltipText}</div>
                    </div>
                  ` : ''}
                </div>
              `;
              }).join('')}
            </div>
            <div class="retention-meter ${hasEpisodes ? '' : 'is-muted'}">
              <span class="retention-fill" style="width: ${retentionLevel}%"></span>
            </div>
            <div class="card-reason">${safeReason}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render active filters summary
   */
  renderActiveFilters() {
    const container = document.getElementById('active-filters');
    const list = document.getElementById('active-filters-list');
    const empty = document.getElementById('active-filters-empty');
    const label = document.getElementById('active-filters-label');
    const clearBtn = document.getElementById('active-filters-clear');
    if (!container || !list || !empty || !label || !clearBtn) return;

    const active = [];
    Object.entries(this.activeFilters).forEach(([type, values]) => {
      values.forEach(value => {
        if (value === null || value === undefined || value === '') return;
        active.push({
          type,
          value,
          label: this.filterTypeLabels[type] || type
        });
      });
    });

    if (active.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'inline';
      label.textContent = 'Personalize recommendations';
      clearBtn.style.display = 'none';
      container.classList.add('is-empty');
      return;
    }

    container.classList.remove('is-empty');
    label.textContent = `Active filters (${active.length})`;
    clearBtn.style.display = 'inline-flex';
    empty.style.display = 'none';
    list.innerHTML = active.map(item => {
      const displayValue = String(item.value);
      const safeValueText = this.escapeHtml(displayValue);
      const safeValueAttr = this.escapeAttr(displayValue);
      const safeTypeAttr = this.escapeAttr(item.type);
      const safeLabel = this.escapeHtml(item.label);
      return `
        <button class="active-filter-pill"
                type="button"
                data-action="toggle-filter"
                data-filter-type="${safeTypeAttr}"
                data-filter-value="${safeValueAttr}">
          <span class="active-filter-pill-label">${safeLabel}</span>
          ${safeValueText}
          <span class="active-filter-pill-remove" aria-hidden="true">&times;</span>
        </button>
      `;
    }).join('');
  },

  /**
   * Render recommendations section
   */
  renderRecommendations() {
    const container = document.getElementById('recommendations-grid');
    const contextEl = document.getElementById('recommendations-context');
    if (!container) return;
    container.classList.remove('is-loading');

    if (contextEl) {
      contextEl.textContent = 'Retention-first picks blended with MAL satisfaction for more dependable recommendations.';
    }

    // Get recommendations
    const recommendations = Recommendations.getRecommendations(
      this.filteredData,
      6
    );

    if (recommendations.length === 0) {
      container.innerHTML = '<p class="no-data">No recommendations available</p>';
      return;
    }

    container.innerHTML = recommendations.map(anime => {
      const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
      const retention = hasEpisodes ? `${Math.round(anime.stats.retentionScore)}%` : 'N/A';
      const malSatisfaction = Number.isFinite(anime.communityScore) ? `${anime.communityScore.toFixed(1)}/10` : 'N/A';
      const retentionTooltipTitle = this.escapeHtml('Retention Score');
      const retentionTooltipText = this.escapeHtml('How consistently people keep watching across episodes.');
      const satisfactionTooltipTitle = this.escapeHtml('Satisfaction Score');
      const satisfactionTooltipText = this.escapeHtml('Community rating from MyAnimeList.');
      const safeRetention = this.escapeHtml(retention);
      const safeSatisfaction = this.escapeHtml(malSatisfaction);
      const safeId = this.escapeAttr(anime.id);
      const safeTitle = this.escapeHtml(anime.title);
      const safeCover = this.escapeAttr(this.sanitizeUrl(anime.cover));
      const safeReason = this.escapeHtml(anime.reason || '');

      return `
        <div class="recommendation-card" data-action="open-anime" data-anime-id="${safeId}">
          <div class="recommendation-media">
            <img src="${safeCover}" alt="${safeTitle}" class="recommendation-cover" data-fallback-src="https://via.placeholder.com/180x120?text=No+Image">
          </div>
          <div class="recommendation-info">
            <div class="recommendation-title">${safeTitle}</div>
            <div class="recommendation-meta">
              <span class="recommendation-stat has-tooltip" tabindex="0">
                Retention ${safeRetention}
                <div class="tooltip tooltip--bottom" role="tooltip">
                  <div class="tooltip-title">${retentionTooltipTitle}</div>
                  <div class="tooltip-text">${retentionTooltipText}</div>
                </div>
              </span>
              <span class="recommendation-stat has-tooltip" tabindex="0">
                Satisfaction (MAL) ${safeSatisfaction}
                <div class="tooltip tooltip--bottom" role="tooltip">
                  <div class="tooltip-title">${satisfactionTooltipTitle}</div>
                  <div class="tooltip-text">${satisfactionTooltipText}</div>
                </div>
              </span>
              </div>
              <div class="recommendation-reason">${safeReason}</div>
            </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Render rankings section
   */
  renderRankings() {
    const container1 = document.getElementById('best-ranking-1');
    const container2 = document.getElementById('best-ranking-2');
    const title1 = document.getElementById('ranking-title-1');
    const title2 = document.getElementById('ranking-title-2');

    if (!container1 || !container2) return;
    container1.removeAttribute('aria-busy');
    container2.removeAttribute('aria-busy');

    const dataToUse = this.filteredData;

    // Get ranking config
    const rankingConfig = Recommendations.getRankingTitles();

    // Update titles
    if (title1) title1.textContent = rankingConfig.title1;
    if (title2) title2.textContent = rankingConfig.title2;

    // Ranking 1
    const byMetric1 = Stats.rankAnime(dataToUse, rankingConfig.metric1);
    if (byMetric1.length > 0) {
      const best = byMetric1[0];
      container1.innerHTML = this.renderRankingCard(best, rankingConfig.metric1);
    } else {
      container1.innerHTML = '<p class="no-data">No anime match filters</p>';
    }

    // Ranking 2
    const byMetric2 = Stats.rankAnime(dataToUse, rankingConfig.metric2);
    if (byMetric2.length > 0) {
      const best = byMetric2[0];
      container2.innerHTML = this.renderRankingCard(best, rankingConfig.metric2);
    } else {
      container2.innerHTML = '<p class="no-data">No anime match filters</p>';
    }
  },

  /**
   * Render a ranking card with appropriate metric display
   */
  renderRankingCard(anime, metric) {
    let valueDisplay = 'N/A';
    let labelDisplay = '';
    let valueClass = '';

    if (metric === 'retention') {
      const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
      if (hasEpisodes) {
        const score = Math.round(anime.stats.retentionScore);
        valueDisplay = `${score}%`;
        valueClass = Recommendations.getRetentionClass(score);
      }
      labelDisplay = 'retention score';
    } else if (metric === 'satisfaction') {
      if (Number.isFinite(anime.communityScore)) {
        valueDisplay = `${anime.communityScore.toFixed(1)}/10`;
        valueClass = Recommendations.getMalSatisfactionClass(anime.communityScore);
      }
      labelDisplay = 'satisfaction score (MAL)';
    } else {
      valueDisplay = anime.stats.average;
      labelDisplay = 'avg score';
      valueClass = anime.stats.scoreClass;
    }

    return `
      <div class="ranking-anime">
        <img src="${this.escapeAttr(this.sanitizeUrl(anime.cover))}" alt="${this.escapeHtml(anime.title)}" class="ranking-cover" data-fallback-src="https://via.placeholder.com/60x85?text=No+Image">
        <div class="ranking-info">
          <div class="ranking-title">${this.escapeHtml(anime.title)}</div>
          <div class="ranking-score ${valueClass}">
            <span class="score-value">${valueDisplay}</span>
            <span class="score-label">${labelDisplay}</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Render anime grid with pagination
   */
  renderAnimeGrid({ append = false } = {}) {
    const container = document.getElementById('anime-grid');
    if (!container) return;
    container.classList.remove('is-loading');

    const sorted = this.getSortedGridData();

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <h3>No matches yet</h3>
          <p>Try removing a filter or two—there might be a hidden gem waiting.</p>
        </div>
      `;
      return;
    }

    const shouldAppend = append && this.gridRenderedCount > 0;
    const startIndex = shouldAppend ? this.gridRenderedCount : 0;
    const endIndex = Math.min(sorted.length, this.gridCurrentPage * this.gridPageSize);
    const visibleAnime = sorted.slice(startIndex, endIndex);
    const hasMore = endIndex < sorted.length;

    if (!shouldAppend) {
      container.innerHTML = this.renderAnimeCards(visibleAnime);
    } else if (visibleAnime.length > 0) {
      const loadMoreEl = container.querySelector('.load-more-container');
      if (loadMoreEl) {
        loadMoreEl.remove();
      }
      container.insertAdjacentHTML('beforeend', this.renderAnimeCards(visibleAnime));
    }

    this.gridRenderedCount = endIndex;

    // Add "Load More" button if there are more items
    if (hasMore) {
      container.insertAdjacentHTML('beforeend', `
        <div class="load-more-container">
          <button class="load-more-btn" data-action="load-more">
            Load More (${sorted.length - endIndex} remaining)
          </button>
        </div>
      `);
    }

  },

  /**
   * Load more anime cards
   */
  loadMoreAnime() {
    this.gridCurrentPage++;
    this.renderAnimeGrid({ append: true });
  },

  /**
   * Reset pagination when filters change
   */
  resetGridPagination() {
    this.gridCurrentPage = 1;
    this.gridRenderedCount = 0;
    this.gridSortedCache = null;
    this.gridSortedKey = '';
    this.gridSortedSource = null;
  },

  /**
   * Sort anime list by metric (descending)
   * @param {Array} animeList - Array of anime
   * @param {string} metricKey - Sort metric key
   * @returns {Array} Sorted array
   */
  sortAnimeByMetric(animeList, metricKey) {
    const list = [...animeList];
    const key = metricKey === 'satisfaction' ? 'satisfaction' : 'retention';

    list.sort((a, b) => {
      const aVal = key === 'satisfaction'
        ? (Number.isFinite(a.communityScore) ? a.communityScore : 0)
        : (a.stats?.retentionScore ?? 0);
      const bVal = key === 'satisfaction'
        ? (Number.isFinite(b.communityScore) ? b.communityScore : 0)
        : (b.stats?.retentionScore ?? 0);
      return bVal - aVal;
    });

    return list;
  },

  /**
   * Handle card click
   */
  handleCardClick(animeId) {
    this.showAnimeDetail(animeId);
  },

  setupActionDelegates() {
    document.addEventListener('click', (event) => {
      const actionEl = event.target.closest('[data-action]');
      if (!actionEl) return;

      const action = actionEl.dataset.action;
      if (action === 'home-shortcut') {
        if (this.isCatalogPage()) {
          event.preventDefault();
          if (this.currentAnimeId) {
            this.closeDetailModal({ updateUrl: false });
          }
          this.clearAllFilters();
        }
        return;
      }

      if (action === 'toggle-filter') {
        const type = actionEl.dataset.filterType;
        const value = actionEl.dataset.filterValue;
        const isQuickChip = actionEl.classList.contains('quick-chip');
        if (type && value !== undefined) {
          this.toggleFilter(type, value);
        }
        if (isQuickChip) {
          const isMobile = window.matchMedia?.('(max-width: 640px)')?.matches;
          if (this.getActiveFilterCount() >= 2) {
            this.scrollToResultsSection();
          }
        }
        return;
      }

      if (action === 'quick-tab') {
        const tabKey = actionEl.dataset.tab;
        const tabs = document.querySelectorAll('.quick-tab');
        const tracks = document.querySelectorAll('.quick-filters-track');
        if (!tabKey || tabs.length === 0 || tracks.length === 0) return;
        tabs.forEach(tab => {
          const isActive = tab === actionEl;
          tab.classList.toggle('is-active', isActive);
          tab.setAttribute('aria-selected', String(isActive));
        });
        tracks.forEach(track => {
          const isActive = track.dataset.filterGroup === tabKey;
          track.classList.toggle('is-active', isActive);
        });
        return;
      }

      if (action === 'toggle-quick-more') {
        const type = actionEl.dataset.filterType;
        if (!type || !this.quickFilterState[type]) return;
        this.quickFilterState[type].expanded = !this.quickFilterState[type].expanded;
        this.renderQuickFilters();
        return;
      }

      if (action === 'scroll-to-filters') {
        this.scrollToFiltersSection();
        return;
      }

      if (action === 'toggle-bookmark') {
        const animeId = actionEl.dataset.animeId || this.currentAnimeId;
        if (animeId) {
          this.toggleBookmark(animeId);
        }
        return;
      }

      if (action === 'open-anime') {
        const animeId = actionEl.dataset.animeId;
        if (animeId) {
          this.showAnimeDetail(animeId);
        }
        const dropdown = actionEl.closest('.header-search-dropdown');
        if (dropdown) {
          dropdown.classList.remove('visible');
          const input = document.getElementById('header-search');
          if (input) {
            input.value = '';
          }
        }
        return;
      }

      if (action === 'load-more') {
        this.loadMoreAnime();
      }
    });
  },

  setupImageFallbacks() {
    document.addEventListener('error', (event) => {
      const target = event.target;
      if (!target || target.tagName !== 'IMG') return;
      const fallback = target.dataset.fallbackSrc;
      if (!fallback || target.dataset.fallbackApplied) return;
      target.dataset.fallbackApplied = '1';
      target.src = fallback;
    }, true);
  },

  /**
   * Render similar anime section for the detail modal
   * @param {Object} anime - Current anime
   * @returns {string} HTML string
   */
  renderSimilarAnimeSection(anime) {
    const similarResults = Recommendations.getSimilarAnime(this.animeData, anime, 6);
    const hasGenres = Array.isArray(anime?.genres) && anime.genres.length > 0;
    const hasThemes = Array.isArray(anime?.themes) && anime.themes.length > 0;
    const canMatch = hasGenres && hasThemes;

    const formatTags = (tags, max = 2) => {
      if (!Array.isArray(tags) || tags.length === 0) return 'None';
      const trimmed = tags.slice(0, max);
      const extra = tags.length - trimmed.length;
      return extra > 0 ? `${trimmed.join(', ')} +${extra}` : trimmed.join(', ');
    };

    const emptyMessage = canMatch
      ? 'No similar anime found yet.'
      : 'Similar anime needs both genre and theme tags for this title.';

    return `
      <div class="similar-anime">
        <div class="detail-section-header">
          <h3>Similar Anime</h3>
          <span class="detail-section-note">Shared genre + theme, aligned retention and satisfaction</span>
        </div>
        ${similarResults.length > 0 ? `
          <div class="similar-grid">
            ${similarResults.map(result => {
              const similar = result.anime;
              const hasEpisodes = Array.isArray(similar.episodes) && similar.episodes.length > 0;
              const retentionScore = hasEpisodes ? Math.round(similar.stats.retentionScore) : null;
              const satisfactionScore = Number.isFinite(similar.communityScore) ? similar.communityScore : null;
              const retentionClass = Recommendations.getRetentionClass(retentionScore);
              const satisfactionClass = Recommendations.getMalSatisfactionClass(satisfactionScore);
              const sharedGenres = formatTags(result.sharedGenres);
              const sharedThemes = formatTags(result.sharedThemes);
              const safeId = this.escapeAttr(similar.id);
              const safeTitle = this.escapeHtml(similar.title);
              const safeCover = this.escapeAttr(this.sanitizeUrl(similar.cover));
              const safeGenres = this.escapeHtml(sharedGenres);
              const safeThemes = this.escapeHtml(sharedThemes);

              return `
                <div class="similar-card" data-action="open-anime" data-anime-id="${safeId}">
                  <img src="${safeCover}" alt="${safeTitle}" class="similar-cover" data-fallback-src="https://via.placeholder.com/200x140?text=No+Image">
                  <div class="similar-info">
                    <div class="similar-title">${safeTitle}</div>
                    <div class="similar-tags">
                      <span class="similar-tag">Genres: ${safeGenres}</span>
                      <span class="similar-tag">Themes: ${safeThemes}</span>
                    </div>
                    <div class="similar-stats">
                      <span class="similar-stat ${retentionClass}">Retention ${retentionScore !== null ? `${retentionScore}%` : 'N/A'}</span>
                      <span class="similar-stat ${satisfactionClass}">Satisfaction (MAL) ${satisfactionScore !== null ? `${satisfactionScore.toFixed(1)}/10` : 'N/A'}</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <p class="similar-empty">${emptyMessage}</p>
        `}
      </div>
    `;
  },

  /**
   * Show anime detail modal
   */
  showAnimeDetail(animeId, { updateUrl = true } = {}) {
    this.stopTrailerPlayback();
    this.teardownTrailerObserver();

    const anime = this.animeData.find(a => a.id === animeId);
    if (!anime) {
      if (updateUrl) {
        this.updateUrlForAnime(null, { replace: true });
      }
      this.resetMetaToDefault();
      return;
    }

    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');
    const modalContent = modal ? modal.querySelector('.modal-content') : null;

    if (!modal || !content) return;

    this.currentAnimeId = anime.id;

    if (updateUrl) {
      this.updateUrlForAnime(anime.id);
    }

    // Build genres and themes tags
    const genreTags = anime.genres && anime.genres.length > 0
      ? anime.genres.map(g => `<span class="detail-tag">${this.escapeHtml(g)}</span>`).join('')
      : '';
    const themeTags = anime.themes && anime.themes.length > 0
      ? anime.themes.map(t => `<span class="detail-tag">${this.escapeHtml(t)}</span>`).join('')
      : '';

    const synopsis = this.getSynopsisForAnime(anime);
    const synopsisMarkup = ReviewsService.renderSynopsis(synopsis);
    const synopsisSection = synopsisMarkup || ReviewsService.renderSynopsisLoading();
    const trailerSection = this.renderTrailerSection(anime);
    const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
    const retentionScore = hasEpisodes ? Math.round(anime.stats.retentionScore) : null;
    const malSatisfactionScore = Number.isFinite(anime.communityScore) ? anime.communityScore : null;
    const retentionClass = Recommendations.getRetentionClass(retentionScore);
    const malSatisfactionClass = Recommendations.getMalSatisfactionClass(malSatisfactionScore);
    const startScore = hasEpisodes ? Math.round(anime.stats.threeEpisodeHook) : null;
    const stayScore = hasEpisodes ? Math.round(100 - anime.stats.churnRisk.score) : null;
    const finishScore = hasEpisodes ? Math.round(anime.stats.worthFinishing) : null;

    const metaParts = [anime.type, anime.year, anime.studio, anime.source, anime.demographic]
      .map(value => {
        const label = String(value ?? '').trim();
        const normalized = label.toLowerCase();
        if (!label || normalized === 'undefined' || normalized === 'null') return '';
        return label;
      })
      .filter(Boolean);
    const metaHtml = metaParts.map(part => `<span>${this.escapeHtml(part)}</span>`).join(' &bull; ');
    const safeTitle = this.escapeHtml(anime.title);
    const safeCover = this.escapeAttr(this.sanitizeUrl(anime.cover));

    const altTitles = [];
    if (anime.titleEnglish && anime.titleEnglish.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'English', value: anime.titleEnglish });
    }
    if (anime.titleJapanese && anime.titleJapanese.toLowerCase() !== anime.title.toLowerCase()) {
      altTitles.push({ label: 'Japanese', value: anime.titleJapanese });
    }
    const altTitlesHtml = altTitles.length
      ? `<div class="detail-alt-titles">
          ${altTitles.map(item => `
            <div class="detail-alt-title">
              <span class="detail-alt-label">${this.escapeHtml(item.label)}</span>
              <span class="detail-alt-value">${this.escapeHtml(item.value)}</span>
            </div>
          `).join('')}
        </div>`
      : '';
    const similarSection = this.renderSimilarAnimeSection(anime);

    content.innerHTML = `
      <div class="detail-header">
        <img src="${safeCover}" alt="${safeTitle}" class="detail-cover" data-fallback-src="https://via.placeholder.com/150x210?text=No+Image">
        <div class="detail-info">
          <div class="detail-title-row">
            <h2 class="detail-title">${safeTitle}</h2>
            <button class="modal-bookmark detail-bookmark" id="bookmark-toggle" type="button" data-action="toggle-bookmark" aria-pressed="false" aria-label="Add bookmark" title="Add bookmark">&#9733;</button>
          </div>
          ${altTitlesHtml}
          <div class="detail-meta">
            ${metaHtml}
          </div>
          <div class="detail-tags">
            ${genreTags}${themeTags}
          </div>
          <div class="detail-stats">
            <div class="detail-stat has-tooltip" tabindex="0">
              <span class="detail-stat-value ${retentionClass}">${retentionScore !== null ? `${retentionScore}%` : 'N/A'}</span>
              <span class="detail-stat-label">Retention Score</span>
              <div class="tooltip" role="tooltip">
                <div class="tooltip-title">Retention Score</div>
                <div class="tooltip-text">How consistently people keep watching across episodes. Factors in strong starts, low drop-off, and steady pacing.</div>
              </div>
            </div>
            <div class="detail-stat has-tooltip" tabindex="0">
              <span class="detail-stat-value ${malSatisfactionClass}">${malSatisfactionScore !== null ? `${malSatisfactionScore.toFixed(1)}/10` : 'N/A'}</span>
              <span class="detail-stat-label">Satisfaction (MAL)</span>
              <div class="tooltip" role="tooltip">
                <div class="tooltip-title">Satisfaction Score</div>
                <div class="tooltip-text">Community rating from MyAnimeList.</div>
              </div>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${anime.stats.episodeCount || 'N/A'}</span>
              <span class="detail-stat-label">Episodes</span>
            </div>
          </div>
        </div>
      </div>
      ${hasEpisodes ? `
        <div class="detail-breakdown">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
            <span class="detail-section-note">Start, stay, finish</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Strong start
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Strong Start</div>
                <div class="tooltip-text">How compelling the first 3 episodes are. High scores mean the show hooks viewers early.</div>
              </div>
            </span>
            <div class="breakdown-bar">
              <span class="breakdown-fill" style="width: ${startScore}%"></span>
            </div>
            <span class="breakdown-value">${startScore}%</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Keeps you watching
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Keeps You Watching</div>
                <div class="tooltip-text">Low drop-off probability. Measures how likely viewers are to continue without losing interest.</div>
              </div>
            </span>
            <div class="breakdown-bar">
              <span class="breakdown-fill" style="width: ${stayScore}%"></span>
            </div>
            <span class="breakdown-value">${stayScore}%</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label has-tooltip" tabindex="0">
              Finish payoff
              <div class="tooltip tooltip--bottom" role="tooltip">
                <div class="tooltip-title">Finish Payoff</div>
                <div class="tooltip-text">How well the show sticks the landing. Combines finale strength, momentum, and narrative build-up.</div>
              </div>
            </span>
            <div class="breakdown-bar">
              <span class="breakdown-fill" style="width: ${finishScore}%"></span>
            </div>
            <span class="breakdown-value">${finishScore}%</span>
          </div>
        </div>
      ` : `
        <div class="detail-breakdown detail-breakdown-empty">
          <div class="detail-section-header">
            <h3>Why it sticks</h3>
          </div>
          <p class="detail-empty">No episode scores yet. Retention appears once episode scores are available.</p>
        </div>
      `}
      <div id="synopsis-section">
        ${synopsisSection}
      </div>
      ${trailerSection}
      <div id="community-reviews-section">
        ${ReviewsService.renderLoading()}
      </div>
      <div id="similar-anime-section">
        ${similarSection}
      </div>
    `;

    this.updateBookmarkToggle(anime.id);

    if (modalContent) {
      modalContent.scrollTop = 0;
    }
    content.scrollTop = 0;

    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    this.updateMetaForAnime(anime, synopsis);
    this.setupTrailerAutoplay(modalContent);

    // Load community reviews
    this.loadCommunityReviews(anime, synopsis);
  },

  /**
   * Load community reviews and synopsis from MyAnimeList
   */
  async loadCommunityReviews(anime, fallbackSynopsis = '') {
    const reviewsSection = document.getElementById('community-reviews-section');
    const synopsisSection = document.getElementById('synopsis-section');

    try {
      const data = await ReviewsService.fetchReviews(anime.malId, anime.title);

      if (this.currentAnimeId !== anime.id) {
        return;
      }

      // Update synopsis section
      if (synopsisSection) {
        if (data.description) {
          synopsisSection.innerHTML = ReviewsService.renderSynopsis(data.description);
        } else if (fallbackSynopsis) {
          synopsisSection.innerHTML = ReviewsService.renderSynopsis(fallbackSynopsis);
        } else {
          synopsisSection.innerHTML = '';
        }
      }

      // Update reviews section
      if (reviewsSection) {
        reviewsSection.innerHTML = ReviewsService.renderReviewsSection(data, 'positive');
        ReviewsService.initTabSwitching(data);
      }

      if (data.description) {
        this.updateMetaForAnime(anime, data.description);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);

      // Clear synopsis loading state on error
      if (synopsisSection) {
        if (!fallbackSynopsis) {
          synopsisSection.innerHTML = '';
        }
      }

      if (reviewsSection) {
        reviewsSection.innerHTML = ReviewsService.renderReviewsSection(
          { positive: [], neutral: [], negative: [], description: '', error: true },
          'positive'
        );
      }
    }
  },

  /**
   * Build sanitized trailer URLs from stored metadata.
   */
  buildTrailerUrls(trailer) {
    if (!trailer || typeof trailer !== 'object') {
      return { url: '', embedUrl: '' };
    }

    const id = trailer.id;
    let url = trailer.url || '';
    let embedUrl = trailer.embedUrl || trailer.embed_url || '';

    if (!url && id) {
      url = `https://www.youtube.com/watch?v=${id}`;
    }

    if (!embedUrl && id) {
      embedUrl = `https://www.youtube.com/embed/${id}`;
    }

    return {
      url: this.sanitizeTrailerUrl(url),
      embedUrl: this.sanitizeTrailerEmbedUrl(embedUrl)
    };
  },

  /**
   * Ensure trailer URLs only point to trusted YouTube hosts.
   */
  sanitizeTrailerUrl(rawUrl) {
    if (!rawUrl) return '';

    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('youtube.com') && !host.includes('youtu.be')) return '';
      return parsed.toString();
    } catch (error) {
      return '';
    }
  },

  sanitizeTrailerEmbedUrl(rawUrl) {
    if (!rawUrl) return '';

    try {
      const parsed = new URL(rawUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('youtube.com') && !host.includes('youtube-nocookie.com')) return '';
      parsed.searchParams.delete('autoplay');
      return parsed.toString();
    } catch (error) {
      return '';
    }
  },

  /**
   * Render the trailer section for the detail modal.
   */
  renderTrailerSection(anime) {
    const trailer = anime?.trailer;
    if (!trailer) return '';

    const { url, embedUrl } = this.buildTrailerUrls(trailer);
    if (!url && !embedUrl) return '';

    const title = anime?.title ? `Trailer for ${anime.title}` : 'Anime trailer';
    const safeTitle = this.escapeAttr(title);
    const safeUrl = this.escapeAttr(url);
    const safeEmbedUrl = this.escapeAttr(embedUrl);

    return `
      <div class="detail-trailer">
        <div class="detail-section-header">
          <h3>Trailer</h3>
          ${url ? `<a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>` : ''}
        </div>
        ${embedUrl
          ? `<div class="trailer-embed">
              <iframe
                src="about:blank"
                data-embed-src="${safeEmbedUrl}"
                title="${safeTitle}"
                loading="lazy"
                allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>`
          : `<div class="trailer-fallback">
              <a class="trailer-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
            </div>`
        }
      </div>
    `;
  },

  buildAutoplayEmbedUrl(embedUrl) {
    const safeEmbedUrl = this.sanitizeTrailerEmbedUrl(embedUrl);
    if (!safeEmbedUrl) return '';

    try {
      const url = new URL(safeEmbedUrl);
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '1');
      url.searchParams.set('playsinline', '1');
      return url.toString();
    } catch (error) {
      return '';
    }
  },

  isElementInScrollView(element, root, threshold = 0.4) {
    if (!element) return false;
    const targetRect = element.getBoundingClientRect();
    if (!root) {
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const visibleHeight = Math.max(0, Math.min(targetRect.bottom, viewportHeight) - Math.max(targetRect.top, 0));
      return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
    }

    const rootRect = root.getBoundingClientRect();
    const visibleTop = Math.max(targetRect.top, rootRect.top);
    const visibleBottom = Math.min(targetRect.bottom, rootRect.bottom);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    return targetRect.height > 0 && (visibleHeight / targetRect.height) >= threshold;
  },

  setupTrailerAutoplay(modalContent) {
    this.teardownTrailerObserver();
    this.teardownTrailerScrollListener();
    const trailerEmbed = document.querySelector('.detail-trailer .trailer-embed');
    if (!trailerEmbed) return;

    const iframe = trailerEmbed.querySelector('iframe');
    if (!iframe || !iframe.dataset.embedSrc) return;

    const root = modalContent || document.querySelector('#detail-modal .modal-content');
    if (!('IntersectionObserver' in window)) {
      this.startTrailerAutoplay(iframe);
      return;
    }

    const observer = new IntersectionObserver((entries, activeObserver) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          this.startTrailerAutoplay(iframe);
          activeObserver.disconnect();
          this.trailerObserver = null;
          this.teardownTrailerScrollListener();
          break;
        }
      }
    }, {
      root: root || null,
      threshold: 0.4
    });

    observer.observe(trailerEmbed);
    this.trailerObserver = observer;

    const scrollRoot = root || window;
    const handler = () => {
      if (this.isElementInScrollView(trailerEmbed, root || null, 0.35)) {
        this.startTrailerAutoplay(iframe);
        this.teardownTrailerObserver();
        this.teardownTrailerScrollListener();
      }
    };

    this.trailerScrollRoot = scrollRoot;
    this.trailerScrollHandler = handler;
    scrollRoot.addEventListener('scroll', handler, { passive: true });
    requestAnimationFrame(handler);
  },

  startTrailerAutoplay(iframe) {
    if (!iframe || iframe.dataset.autoplayStarted === '1') return;
    const embedSrc = iframe.dataset.embedSrc;
    if (!embedSrc) return;

    const autoplaySrc = this.buildAutoplayEmbedUrl(embedSrc);
    if (!autoplaySrc) return;

    iframe.dataset.autoplayStarted = '1';
    iframe.removeAttribute('loading');
    iframe.src = autoplaySrc;
  },

  stopTrailerPlayback() {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    iframe.dataset.autoplayStarted = '';
    iframe.src = 'about:blank';
  },

  teardownTrailerObserver() {
    if (this.trailerObserver) {
      this.trailerObserver.disconnect();
      this.trailerObserver = null;
    }
  },

  teardownTrailerScrollListener() {
    if (this.trailerScrollRoot && this.trailerScrollHandler) {
      this.trailerScrollRoot.removeEventListener('scroll', this.trailerScrollHandler);
    }
    this.trailerScrollRoot = null;
    this.trailerScrollHandler = null;
  },

  /**
   * Close detail modal
   */
  closeDetailModal({ updateUrl = true } = {}) {
    const modal = document.getElementById('detail-modal');
    if (modal) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    }

    this.stopTrailerPlayback();
    this.teardownTrailerObserver();
    this.teardownTrailerScrollListener();
    this.currentAnimeId = null;
    this.updateBookmarkToggle(null);

    if (updateUrl) {
      this.updateUrlForAnime(null);
    }
    this.updateMetaForFilters();
  },

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('app-container');
    if (container) {
      const safeMessage = this.escapeHtml(message);
      container.innerHTML = `
        <div class="error-message">
          <h2>Error</h2>
          <p>${safeMessage}</p>
        </div>
      `;
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const start = () => App.init();
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(start);
  } else {
    setTimeout(start, 0);
  }
});


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
  basePageUrl: '',
  defaultMeta: {
    title: '',
    description: '',
    image: '',
    url: ''
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
      await this.loadData();
      this.calculateAllStats();
      this.extractFilterOptions();
      this.filteredData = [...this.animeData];

      this.updateSortOptions();

      this.renderFilterPanel();
      this.renderQuickFilters();
      this.render();
      this.setupEventListeners();
      this.initSeo();
      this.syncModalWithUrl();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('We couldn\'t load the catalog. Try refreshing—if it persists, the data might be updating.');
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
   * Load anime data from JSON file (with fallback for file:// protocol)
   */
  async loadData() {
    try {
      const response = await fetch('data/anime.json');
      if (!response.ok) {
        throw new Error('Failed to fetch anime data');
      }
      const data = await response.json();
      this.animeData = this.normalizeAnimeData(data.anime || []);
    } catch (error) {
      // Fallback: try loading from embedded data (for file:// protocol)
      if (typeof ANIME_DATA !== 'undefined') {
        this.animeData = this.normalizeAnimeData(ANIME_DATA.anime || []);
      } else {
        throw error;
      }
    }
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
      const rawCommunityScore = anime?.metadata?.score ?? anime?.score;
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
          searchText: this.buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
          episodes: anime.episodes || []
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
        searchText: this.buildSearchText(resolvedTitle, normalizedTitleEnglish, normalizedTitleJapanese),
        episodes: anime.episodes || []
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
      this.syncModalWithUrl({ updateUrl: false });
    });

    // Header search
    this.setupHeaderSearch();
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
    const canonicalUrl = this.buildCanonicalUrl(window.location.href);

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
      return this.buildCanonicalUrl(url.toString());
    } catch (error) {
      return '';
    }
  },

  buildCanonicalUrl(sourceUrl) {
    try {
      const url = new URL(sourceUrl || window.location.href);
      url.hash = '';
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
    const script = document.getElementById('structured-data');
    if (!script) return;

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
      const altTitleMarkup = altTitles.length
        ? `<div class="search-result-alt">${altTitles.join(' • ')}</div>`
        : '';
      return `
      <div class="search-result-item" data-id="${anime.id}">
        <img src="${anime.cover}" alt="${anime.title}" class="search-result-cover" onerror="this.src='https://via.placeholder.com/40x56?text=No'">
        <div class="search-result-info">
          <div class="search-result-title">${anime.title}</div>
          ${altTitleMarkup}
          <div class="search-result-meta">${anime.year} &bull; ${anime.studio}</div>
        </div>
      </div>
    `;
    }).join('');

    dropdown.classList.add('visible');

    // Add click listeners to search results
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const animeId = item.dataset.id;
        this.showAnimeDetail(animeId);
        dropdown.classList.remove('visible');
        document.getElementById('header-search').value = '';
      });
    });
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

      return `
        <div class="filter-section">
          <div class="filter-section-title">${config.label}</div>
          <div class="filter-pills">
            ${options.map(option => {
              const optionStr = String(option);
              const isActive = this.activeFilters[config.key].includes(optionStr) || this.activeFilters[config.key].includes(option);
              return `
              <button class="filter-pill ${isActive ? 'active' : ''}"
                      data-filter-type="${config.key}"
                      data-filter-value="${optionStr}"
                      onclick="App.toggleFilter('${config.key}', '${optionStr.replace(/'/g, "\\'")}')">
                ${optionStr}
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

    if (genreContainer && this.filterOptions.genres) {
      genreContainer.innerHTML = this.filterOptions.genres.map(genre => {
        const isActive = this.activeFilters.genres.includes(genre);
        return `
          <button class="quick-chip ${isActive ? 'active' : ''}"
                  data-filter-type="genres"
                  data-filter-value="${genre}"
                  onclick="App.toggleFilter('genres', '${genre.replace(/'/g, "\\'")}')">
            ${genre}
          </button>
        `;
      }).join('');
    }

    if (themeContainer && this.filterOptions.themes) {
      themeContainer.innerHTML = this.filterOptions.themes.map(theme => {
        const isActive = this.activeFilters.themes.includes(theme);
        return `
          <button class="quick-chip ${isActive ? 'active' : ''}"
                  data-filter-type="themes"
                  data-filter-value="${theme}"
                  onclick="App.toggleFilter('themes', '${theme.replace(/'/g, "\\'")}')">
            ${theme}
          </button>
        `;
      }).join('');
    }
  },

  /**
   * Toggle a filter on/off
   */
  toggleFilter(type, value) {
    const index = this.activeFilters[type].indexOf(value);
    if (index > -1) {
      this.activeFilters[type].splice(index, 1);
    } else {
      this.activeFilters[type].push(value);
    }

    // Update pill state in modal
    const pill = document.querySelector(`.filter-pill[data-filter-type="${type}"][data-filter-value="${value}"]`);
    if (pill) {
      pill.classList.toggle('active');
    }

    // Update quick chip state
    const chip = document.querySelector(`.quick-chip[data-filter-type="${type}"][data-filter-value="${value}"]`);
    if (chip) {
      chip.classList.toggle('active');
    }

    this.applyFilters();
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
  applyFilters() {
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
    this.render();
  },

  /**
   * Render the entire dashboard
   */
  render() {
    this.renderActiveFilters();
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
  renderAnimeCards(animeList) {
    return animeList.map((anime) => {
      const badges = Recommendations.getBadges(anime);
      const cardStats = Recommendations.getCardStats(anime);
      const hasEpisodes = Array.isArray(anime.episodes) && anime.episodes.length > 0;
      const retentionLevel = hasEpisodes ? Math.round(anime.stats.retentionScore) : 0;
      const reason = Recommendations.getRecommendationReason(anime);

      return `
        <div class="anime-card"
             data-id="${anime.id}"
             onclick="App.handleCardClick('${anime.id}')">
          <div class="card-media">
            <img src="${anime.cover}" alt="${anime.title}" class="card-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/120x170?text=No+Image'">
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <h3 class="card-title">${anime.title}</h3>
            </div>
            <div class="card-year">${anime.year || 'Unknown'} &bull; ${anime.studio || 'Unknown'}</div>
            ${badges.length > 0 ? `
              <div class="card-badges">
                ${badges.map(b => `<span class="card-badge ${b.class}">${b.label}</span>`).join('')}
              </div>
            ` : ''}
            <div class="card-stats">
              ${cardStats.map(stat => `
                <div class="stat ${stat.tooltip ? 'has-tooltip' : ''}" ${stat.tooltip ? 'tabindex="0"' : ''}>
                  <span class="stat-value ${stat.class || ''}">${stat.value}${stat.suffix || ''}</span>
                  <span class="stat-label">${stat.label}</span>
                  ${stat.tooltip ? `
                    <div class="tooltip tooltip--bottom" role="tooltip">
                      <div class="tooltip-title">${stat.tooltip.title}</div>
                      <div class="tooltip-text">${stat.tooltip.text}</div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
            <div class="retention-meter ${hasEpisodes ? '' : 'is-muted'}">
              <span class="retention-fill" style="width: ${retentionLevel}%"></span>
            </div>
            <div class="card-reason">${reason}</div>
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

    const typeLabels = {
      genres: 'Genre',
      themes: 'Theme',
      demographic: 'Demographic',
      seasonYear: 'Season',
      year: 'Year',
      studio: 'Studio',
      source: 'Source'
    };

    const active = [];
    Object.entries(this.activeFilters).forEach(([type, values]) => {
      values.forEach(value => {
        if (value === null || value === undefined || value === '') return;
        active.push({
          type,
          value,
          label: typeLabels[type] || type
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
      const dataValue = displayValue.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const onclickValue = displayValue.replace(/'/g, "\\'");
      return `
        <button class="active-filter-pill"
                type="button"
                data-filter-type="${item.type}"
                data-filter-value="${dataValue}"
                onclick="App.toggleFilter('${item.type}', '${onclickValue}')">
          <span class="active-filter-pill-label">${item.label}</span>
          ${displayValue}
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

      return `
        <div class="recommendation-card" onclick="App.showAnimeDetail('${anime.id}')">
          <img src="${anime.cover}" alt="${anime.title}" class="recommendation-cover" onerror="this.src='https://via.placeholder.com/180x120?text=No+Image'">
          <div class="recommendation-info">
            <div class="recommendation-title">${anime.title}</div>
            <div class="recommendation-meta">
              <span>Retention ${retention}</span>
              <span>Satisfaction (MAL) ${malSatisfaction}</span>
            </div>
            <div class="recommendation-reason">${anime.reason || ''}</div>
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
        <img src="${anime.cover}" alt="${anime.title}" class="ranking-cover" onerror="this.src='https://via.placeholder.com/60x85?text=No+Image'">
        <div class="ranking-info">
          <div class="ranking-title">${anime.title}</div>
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
          <button class="load-more-btn" onclick="App.loadMoreAnime()">
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

  /**
   * Show anime detail modal
   */
  showAnimeDetail(animeId, { updateUrl = true } = {}) {
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

    if (!modal || !content) return;

    this.currentAnimeId = anime.id;

    if (updateUrl) {
      this.updateUrlForAnime(anime.id);
    }

    // Build genres and themes tags
    const genreTags = anime.genres && anime.genres.length > 0
      ? anime.genres.map(g => `<span class="detail-tag">${g}</span>`).join('')
      : '';
    const themeTags = anime.themes && anime.themes.length > 0
      ? anime.themes.map(t => `<span class="detail-tag">${t}</span>`).join('')
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
    const metaHtml = metaParts.map(part => `<span>${part}</span>`).join(' &bull; ');

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
              <span class="detail-alt-label">${item.label}</span>
              <span class="detail-alt-value">${item.value}</span>
            </div>
          `).join('')}
        </div>`
      : '';

    content.innerHTML = `
      <div class="detail-header">
        <img src="${anime.cover}" alt="${anime.title}" class="detail-cover" onerror="this.src='https://via.placeholder.com/150x210?text=No+Image'">
        <div class="detail-info">
          <h2 class="detail-title">${anime.title}</h2>
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
    `;

    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    this.updateMetaForAnime(anime, synopsis);

    // Load community reviews
    this.loadCommunityReviews(anime, synopsis);
  },

  /**
   * Load community reviews and synopsis from AniList
   */
  async loadCommunityReviews(anime, fallbackSynopsis = '') {
    const reviewsSection = document.getElementById('community-reviews-section');
    const synopsisSection = document.getElementById('synopsis-section');

    try {
      const data = await ReviewsService.fetchReviews(anime.anilistId, anime.title);

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

    return `
      <div class="detail-trailer">
        <div class="detail-section-header">
          <h3>Trailer</h3>
          ${url ? `<a class="trailer-link" href="${url}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>` : ''}
        </div>
        ${embedUrl
          ? `<div class="trailer-embed">
              <iframe
                src="${embedUrl}"
                title="${title}"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen>
              </iframe>
            </div>`
          : `<div class="trailer-fallback">
              <a class="trailer-link" href="${url}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>
            </div>`
        }
      </div>
    `;
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

    this.currentAnimeId = null;

    if (updateUrl) {
      this.updateUrlForAnime(null);
    }

    this.resetMetaToDefault();
  },

  /**
   * Show error message
   */
  showError(message) {
    const container = document.getElementById('app-container');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h2>Error</h2>
          <p>${message}</p>
        </div>
      `;
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

/**
 * Main application logic for Anime Scoring Dashboard
 */

const App = {
  animeData: [],
  filteredData: [],
  selectedAnime: [],
  currentSort: 'average',
  sortDirection: 'desc',
  sortDirectionMode: 'auto',
  compareMode: false,
  filterPanelOpen: false,
  sparklineCharts: {},
  nudgeTimeout: null,

  // Chart limit state
  chartLimit: 20,
  showAllInChart: false,
  chartOffset: 0, // Current offset for chart pagination

  // Pagination state
  gridPageSize: 24,
  gridCurrentPage: 1,

  // Profile state
  currentProfile: null, // 'programmer' | 'completionist' | 'escapist' | 'focuser'

  // Onboarding state
  onboarding: {
    visitCount: 0,
    dismissed: false,
    nudgeShown: false
  },

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

      // Check for saved profile
      this.loadProfile();
      this.initOnboardingState();

      // Show welcome modal if no profile
      if (!this.currentProfile) {
        this.showWelcomeModal();
      } else {
        this.updateSortOptions();
        this.updateChartSortOptions();
        this.updateProfileSelector();
      }

      this.renderFilterPanel();
      this.render();
      this.setupEventListeners();
      this.updateOnboardingUI();
      this.setupScrollNudge();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to load anime data. Please check the data/anime.json file.');
    }
  },

  /**
   * Load profile from localStorage
   */
  loadProfile() {
    const savedProfile = localStorage.getItem('rekonime-profile');
    if (savedProfile && ['programmer', 'completionist', 'escapist', 'focuser'].includes(savedProfile)) {
      this.currentProfile = savedProfile;
    }
  },

  /**
   * Save profile to localStorage
   */
  saveProfile(profile) {
    localStorage.setItem('rekonime-profile', profile);
  },

  /**
   * Show welcome modal for first-time users
   */
  showWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.classList.add('visible');
    }
  },

  /**
   * Hide welcome modal
   */
  hideWelcomeModal() {
    const modal = document.getElementById('welcome-modal');
    if (modal) {
      modal.classList.remove('visible');
    }
  },

  /**
   * Set user profile
   */
  setProfile(profile) {
    this.currentProfile = profile;
    this.saveProfile(profile);
    this.hideWelcomeModal();
    this.updateProfileSelector();
    this.updateSortOptions();
    this.updateChartSortOptions();
    this.currentSort = Recommendations.getSortOptions(profile)[0]?.value || 'average';
    const headerSort = document.getElementById('sort-select');
    if (headerSort) headerSort.value = this.currentSort;
    this.sortDirectionMode = 'auto';
    this.setSortDirection(this.getSortDirectionDefault(this.currentSort), 'auto');
    this.render();
    this.updateOnboardingUI();
  },

  /**
   * Update profile selector UI
   */
  updateProfileSelector() {
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.profile === this.currentProfile);
    });
  },

  /**
   * Get readable profile label
   */
  getProfileLabel(profile) {
    const labels = {
      programmer: 'Weekly Watcher',
      completionist: 'Completionist',
      escapist: 'Casual Viewer',
      focuser: 'Deep Diver'
    };
    return labels[profile] || '';
  },

  /**
   * Build tooltip text from description and example
   */
  buildTooltipText(description, example, note = '') {
    const parts = [];
    if (description) parts.push(description);
    if (note) parts.push(note);
    if (example) parts.push(`Example: ${example}`);
    return parts.join('\n');
  },

  /**
   * Get example text for profile metrics
   */
  getProfileMetricExample(profile) {
    const examples = {
      programmer: '82% = strong hook with low drop risk.',
      completionist: '78% = strong ending with rising momentum.',
      escapist: '88% = smooth, low-stress run.',
      focuser: '80% = high average with few dips.'
    };
    return examples[profile] || '';
  },

  /**
   * Get example text for any metric key
   */
  getMetricExample(metricKey) {
    const examples = {
      threeEpisodeHook: '86% = strong first three episodes.',
      churnRisk: '18% = low chance of dropping.',
      habitBreakRisk: '3 = three-episode slump.',
      momentum: '+12 = recent episodes beat the average.',
      narrativeAcceleration: '0.18 = pacing builds in the second half.',
      flowState: '90% = smooth with few jolts.',
      barrierToEntry: '0.3 = easy early episodes.',
      controversyPotential: 'High = mix of 5s and 1s.',
      sharkJump: 'Ep 10 = permanent drop point.',
      reliability: '84% = consistent with low drop risk.',
      sessionSafety: '92% = almost all episodes 3+.',
      peakEpisodes: '4 = four 5/5 episodes.',
      finaleStrength: '62% = ending stronger than early episodes.',
      worthFinishing: '77% = strong ending plus upward trend.',
      comfort: '85% = stable, low-stress run.',
      emotionalStability: '0.2 = minimal score swings.',
      stressSpikes: '1 = one 1.5+ point drop.',
      productionQuality: '82% = high average with strong trend.',
      improving: '0.15 = scores trend upward.',
      qualityDips: '2 = two episodes 1+ below average.',
      average: '4.3/5 = mostly strong episodes.',
      auc: '78% = strict total score vs. perfect run.',
      consistency: '0.35 = very consistent scores.'
    };
    return examples[metricKey] || '';
  },

  /**
   * Update tooltip text and visibility
   */
  setTooltipText(element, text) {
    if (!element) return;
    const safeText = text || '';
    element.setAttribute('data-tooltip', safeText);
    element.classList.toggle('is-hidden', safeText.length === 0);
  },

  /**
   * Update the metric direction badge text and style
   */
  setMetricDirectionBadge(element, lowerIsBetter) {
    if (!element) return;
    const isLower = Boolean(lowerIsBetter);
    element.textContent = isLower ? 'Lower is better' : 'Higher is better';
    element.classList.toggle('metric-direction-low', isLower);
    element.classList.toggle('metric-direction-high', !isLower);
  },

  /**
   * Track visits and onboarding state
   */
  initOnboardingState() {
    const rawCount = localStorage.getItem('rekonime-visit-count');
    const parsedCount = Number.parseInt(rawCount, 10);
    const nextCount = Number.isFinite(parsedCount) ? parsedCount + 1 : 1;
    this.onboarding.visitCount = nextCount;
    localStorage.setItem('rekonime-visit-count', String(nextCount));
    this.onboarding.dismissed = localStorage.getItem('rekonime-onboarding-dismissed') === 'true';
    this.onboarding.nudgeShown = localStorage.getItem('rekonime-nudge-shown') === 'true';
  },

  /**
   * Update onboarding strip and insights panel UI
   */
  updateOnboardingUI() {
    const strip = document.getElementById('onboarding-strip');
    if (!strip) return;

    const profileLabel = this.getProfileLabel(this.currentProfile);
    const titleEl = document.getElementById('onboarding-title');
    const descEl = document.getElementById('onboarding-desc');
    const profileStep = document.getElementById('onboarding-step-profile');

    if (profileStep) {
      profileStep.textContent = profileLabel
        ? `Viewing style: ${profileLabel} (change in header)`
        : 'Pick a viewing style to set the ranking metric.';
    }

    if (titleEl && descEl) {
      if (this.onboarding.visitCount > 1 && profileLabel) {
        titleEl.textContent = 'Welcome back';
        descEl.textContent = `Dashboard tuned for ${profileLabel}. Try another style to see different rankings.`;
      } else {
        titleEl.textContent = 'How Rekonime works';
        descEl.textContent = 'Episode-by-episode scores reveal consistency, hook strength, and endings.';
      }
    }

    const shouldShow = !this.onboarding.dismissed
      && (this.onboarding.visitCount <= 2 || !this.currentProfile);
    strip.classList.toggle('visible', shouldShow);
  },

  /**
   * Dismiss onboarding strip for future visits
   */
  dismissOnboarding() {
    this.onboarding.dismissed = true;
    localStorage.setItem('rekonime-onboarding-dismissed', 'true');
    this.updateOnboardingUI();
  },

  /**
   * Show or hide the insight panel
   */
  toggleInsightPanel(show) {
    const panel = document.getElementById('insight-panel');
    if (!panel) return;
    panel.classList.toggle('visible', show);
    panel.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) {
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  /**
   * Setup one-time scroll nudge
   */
  setupScrollNudge() {
    if (this.onboarding.nudgeShown) return;
    const nudge = document.getElementById('scroll-nudge');
    if (!nudge) return;

    if (window.scrollY >= 120) {
      this.showScrollNudge();
      return;
    }

    const onScroll = () => {
      if (window.scrollY < 120) return;
      this.showScrollNudge();
      window.removeEventListener('scroll', onScroll);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
  },

  /**
   * Show scroll nudge and mark as seen
   */
  showScrollNudge() {
    const nudge = document.getElementById('scroll-nudge');
    if (!nudge) return;

    this.onboarding.nudgeShown = true;
    localStorage.setItem('rekonime-nudge-shown', 'true');
    nudge.classList.add('visible');

    if (this.nudgeTimeout) {
      clearTimeout(this.nudgeTimeout);
    }
    this.nudgeTimeout = setTimeout(() => {
      this.hideScrollNudge();
    }, 6500);
  },

  /**
   * Hide scroll nudge
   */
  hideScrollNudge() {
    const nudge = document.getElementById('scroll-nudge');
    if (!nudge) return;
    nudge.classList.remove('visible');
    if (this.nudgeTimeout) {
      clearTimeout(this.nudgeTimeout);
      this.nudgeTimeout = null;
    }
  },

  /**
   * Update sort dropdown options based on profile
   */
  updateSortOptions() {
    const select = document.getElementById('sort-select');
    if (!select) return;

    const options = Recommendations.getSortOptions(this.currentProfile);
    select.innerHTML = options.map(opt =>
      `<option value="${opt.value}">${opt.label}</option>`
    ).join('');

    // Set first option as default
    if (options.length > 0) {
      this.currentSort = options[0].value;
    }
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

      // If data has nested metadata structure, flatten it
      if (anime.metadata) {
        return {
          id: anime.metadata.id || anime.id,
          title: anime.metadata.title || anime.title,
          malId: anime.metadata.malId || anime.mal_id || anime.malId,
          anilistId: anime.metadata.anilistId || anime.anilistId,
          cover: anime.metadata.cover || anime.cover,
          year: anime.metadata.year || anime.year,
          season: anime.metadata.season || anime.season,
          studio: anime.metadata.studio || anime.studio,
          source: anime.metadata.source || anime.source,
          genres: normalizedGenres,
          themes: normalizedThemes,
          demographic: anime.metadata.demographic || anime.demographic,
          trailer: normalizedTrailer,
          episodes: anime.episodes || []
        };
      }
      // Already flat structure, ensure all fields exist
      return {
        id: anime.id,
        title: anime.title,
        malId: anime.malId,
        anilistId: anime.anilistId,
        cover: anime.cover,
        year: anime.year,
        season: anime.season,
        studio: anime.studio,
        source: anime.source,
        genres: normalizedGenres,
        themes: normalizedThemes,
        demographic: anime.demographic,
        trailer: normalizedTrailer,
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

  /**
   * Calculate statistics for all anime
   */
  calculateAllStats() {
    this.animeData = this.animeData.map((anime, index) => ({
      ...anime,
      stats: Stats.calculateAllStats(anime),
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
        this.syncSortDirectionWithMetric(this.currentSort);
        this.updateChartSortOptions();
        this.resetGridPagination();
        this.resetChartPagination();
        this.renderAnimeGrid();
        this.renderMainChart();
      });
    }

    // Compare mode toggle
    const compareToggle = document.getElementById('compare-toggle');
    if (compareToggle) {
      compareToggle.addEventListener('click', () => {
        this.toggleCompareMode();
      });
    }

    // Filter toggle
    const filterToggle = document.getElementById('filter-toggle');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => {
        this.toggleFilterPanel();
      });
    }

    const filterNudgeOpen = document.getElementById('filter-nudge-open');
    if (filterNudgeOpen) {
      filterNudgeOpen.addEventListener('click', () => {
        if (!this.filterPanelOpen) {
          this.toggleFilterPanel();
        }
      });
    }

    // Clear all filters
    const clearFilters = document.getElementById('clear-filters');
    if (clearFilters) {
      clearFilters.addEventListener('click', () => {
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

    // Profile selector buttons
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setProfile(btn.dataset.profile);
      });
    });

    // Welcome modal profile cards
    document.querySelectorAll('.profile-card').forEach(card => {
      card.addEventListener('click', () => {
        this.setProfile(card.dataset.profile);
      });
    });

    // Onboarding actions
    const onboardingDismiss = document.getElementById('onboarding-dismiss');
    if (onboardingDismiss) {
      onboardingDismiss.addEventListener('click', () => {
        this.dismissOnboarding();
      });
    }

    const onboardingLearnMore = document.getElementById('onboarding-learn-more');
    if (onboardingLearnMore) {
      onboardingLearnMore.addEventListener('click', () => {
        this.toggleInsightPanel(true);
      });
    }

    const profileHelp = document.getElementById('profile-help');
    if (profileHelp) {
      profileHelp.addEventListener('click', () => {
        this.toggleInsightPanel(true);
      });
    }

    const insightClose = document.getElementById('insight-close');
    if (insightClose) {
      insightClose.addEventListener('click', () => {
        this.toggleInsightPanel(false);
      });
    }

    const nudgeDismiss = document.getElementById('scroll-nudge-dismiss');
    if (nudgeDismiss) {
      nudgeDismiss.addEventListener('click', () => {
        this.hideScrollNudge();
      });
    }

    // Chart limit toggle
    const chartLimitToggle = document.getElementById('chart-limit-toggle');
    if (chartLimitToggle) {
      chartLimitToggle.addEventListener('click', () => {
        this.showAllInChart = !this.showAllInChart;
        this.renderMainChart();
      });
    }

    // Clear selection button (in compare mode banner)
    const clearSelectionBtn = document.getElementById('clear-selection');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        this.clearAnimeSelection();
      });
    }

    // Chart section controls
    this.setupChartSectionControls();

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

    const queryLower = query.toLowerCase();
    const matches = this.animeData
      .filter(anime => anime.title.toLowerCase().includes(queryLower))
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="search-no-results">No anime found</div>';
      dropdown.classList.add('visible');
      return;
    }

    dropdown.innerHTML = matches.map(anime => `
      <div class="search-result-item" data-id="${anime.id}">
        <img src="${anime.cover}" alt="${anime.title}" class="search-result-cover" onerror="this.src='https://via.placeholder.com/40x56?text=No'">
        <div class="search-result-info">
          <div class="search-result-title">${anime.title}</div>
          <div class="search-result-meta">${anime.year} &bull; ${anime.studio}</div>
        </div>
      </div>
    `).join('');

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
   * Setup chart section controls (add to compare, sort, filter)
   */
  setupChartSectionControls() {
    // Chart add to compare search
    const chartAddSearch = document.getElementById('chart-add-search');
    const addDropdown = document.getElementById('chart-add-dropdown');

    if (chartAddSearch && addDropdown) {
      chartAddSearch.addEventListener('input', (e) => {
        this.handleChartAddSearch(e.target.value);
      });

      chartAddSearch.addEventListener('focus', () => {
        if (chartAddSearch.value.length > 0) {
          addDropdown.classList.add('visible');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.chart-add-wrapper')) {
          addDropdown.classList.remove('visible');
        }
      });
    }

    // Chart sort direction select
    const chartDirectionSelect = document.getElementById('chart-direction-select');
    if (chartDirectionSelect) {
      chartDirectionSelect.addEventListener('change', (e) => {
        this.setSortDirection(e.target.value, 'manual');
        this.resetGridPagination();
        this.resetChartPagination();
        this.renderAnimeGrid();
        this.renderMainChart();
      });
    }

    // Chart filter toggle
    const chartFilterToggle = document.getElementById('chart-filter-toggle');
    if (chartFilterToggle) {
      chartFilterToggle.addEventListener('click', () => {
        this.toggleFilterPanel();
      });
    }

    // Clear chart selection button
    const clearChartSelection = document.getElementById('clear-chart-selection');
    if (clearChartSelection) {
      clearChartSelection.addEventListener('click', () => {
        this.clearChartSelection();
      });
    }
  },

  /**
   * Handle chart add search input (for comparison)
   */
  handleChartAddSearch(query) {
    const dropdown = document.getElementById('chart-add-dropdown');
    if (!dropdown) return;

    if (query.length < 2) {
      dropdown.classList.remove('visible');
      dropdown.innerHTML = '';
      return;
    }

    const queryLower = query.toLowerCase();
    // Filter out already selected anime
    const matches = this.filteredData
      .filter(anime =>
        anime.title.toLowerCase().includes(queryLower) &&
        !this.selectedAnime.includes(anime.id)
      )
      .slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="search-no-results">No anime found</div>';
      dropdown.classList.add('visible');
      return;
    }

    dropdown.innerHTML = matches.map(anime => `
      <div class="search-result-item search-add-item" data-id="${anime.id}">
        <img src="${anime.cover}" alt="${anime.title}" class="search-result-cover" onerror="this.src='https://via.placeholder.com/40x56?text=No'">
        <div class="search-result-info">
          <div class="search-result-title">${anime.title}</div>
          <div class="search-result-meta">${anime.year} &bull; ${anime.stats?.average?.toFixed(2) || 'N/A'}/5</div>
        </div>
        <span class="search-add-icon">+</span>
      </div>
    `).join('');

    dropdown.classList.add('visible');

    // Add click listeners - clicking anywhere adds to chart
    dropdown.querySelectorAll('.search-add-item').forEach(item => {
      item.addEventListener('click', () => {
        const animeId = item.dataset.id;
        this.addAnimeToChart(animeId);
        dropdown.classList.remove('visible');
        document.getElementById('chart-add-search').value = '';
      });
    });
  },

  /**
   * Add anime to the chart comparison
   */
  addAnimeToChart(animeId) {
    if (!this.selectedAnime.includes(animeId)) {
      this.selectedAnime.push(animeId);
      this.compareMode = true;
      this.renderMainChart();
      this.updateSelectedAnimeCount();
    }
  },

  /**
   * Clear chart selection
   */
  clearChartSelection() {
    this.selectedAnime = [];
    this.compareMode = false;
    this.renderMainChart();
    this.updateSelectedAnimeCount();

    // Also update anime cards
    document.querySelectorAll('.anime-card.selected').forEach(card => {
      card.classList.remove('selected');
    });
  },

  /**
   * Update selected anime count display
   */
  updateSelectedAnimeCount() {
    const countEl = document.getElementById('selected-anime-count');
    const clearBtn = document.getElementById('clear-chart-selection');

    if (countEl) {
      if (this.compareMode && this.selectedAnime.length > 0) {
        countEl.textContent = `${this.selectedAnime.length} anime selected`;
        countEl.style.display = 'inline';
      } else {
        countEl.style.display = 'none';
      }
    }

    if (clearBtn) {
      clearBtn.style.display = (this.compareMode && this.selectedAnime.length > 0) ? 'inline-block' : 'none';
    }
  },

  /**
   * Update chart sort options based on profile
   */
  updateChartSortOptions() {
    const chipRow = document.getElementById('metric-chip-row');
    if (!chipRow) return;

    let options = Recommendations.getSortOptions(this.currentProfile);
    const profileSortKey = this.getProfileSortKey(this.currentProfile);
    const filteredOptions = options.filter(opt => opt.value !== profileSortKey);
    if (filteredOptions.length > 0) {
      options = filteredOptions;
    }
    const optionValues = options.map(opt => opt.value);
    if (!optionValues.includes(this.currentSort)) {
      this.currentSort = options[0]?.value || 'average';
    }

    chipRow.innerHTML = options.map(opt => {
      const label = opt.label.replace(/^Sort by:\s*/i, '');
      const activeClass = opt.value === this.currentSort ? 'active' : '';
      return `
        <button class="chart-filter-chip metric-chip ${activeClass}" type="button" data-metric="${opt.value}">
          ${label}
        </button>
      `;
    }).join('');

    chipRow.querySelectorAll('.metric-chip').forEach(button => {
      button.addEventListener('click', () => {
        const metric = button.dataset.metric;
        if (!metric || metric === this.currentSort) return;
        this.currentSort = metric;
        this.resetGridPagination();
        this.resetChartPagination();
        this.renderAnimeGrid();
        this.renderMainChart();
        this.updateChartSortOptions();
      });
    });

    this.updateSortDirectionUI();
  },

  /**
   * Determine default sort direction for a metric
   * @param {string} metricKey - Sort metric key
   * @returns {string} Default direction ('asc' or 'desc')
   */
  getSortDirectionDefault(metricKey) {
    return 'desc';
  },

  /**
   * Sync sort direction with metric when user hasn't manually changed it
   * @param {string} metricKey - Sort metric key
   */
  syncSortDirectionWithMetric(metricKey) {
    if (this.sortDirectionMode === 'manual') return;
    this.setSortDirection(this.getSortDirectionDefault(metricKey), 'auto');
  },

  /**
   * Update sort direction and UI state
   * @param {string} direction - 'asc' or 'desc'
   * @param {string} mode - 'auto' or 'manual'
   */
  setSortDirection(direction, mode = 'manual') {
    if (direction !== 'asc' && direction !== 'desc') return;
    this.sortDirection = direction;
    this.sortDirectionMode = mode;
    this.updateSortDirectionUI();
  },

  /**
   * Toggle sort direction and re-render affected views
   */
  toggleSortDirection() {
    const nextDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    this.setSortDirection(nextDirection, 'manual');
    this.resetGridPagination();
    this.resetChartPagination();
    this.renderAnimeGrid();
    this.renderMainChart();
  },

  /**
   * Update sort direction control state
   */
  updateSortDirectionUI() {
    const label = this.sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending';
    const directionSelect = document.getElementById('chart-direction-select');
    if (directionSelect) {
      directionSelect.value = this.sortDirection;
      directionSelect.setAttribute('aria-label', label);
      directionSelect.setAttribute('title', label);
    }
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
    const pill = document.querySelector(`[data-filter-type="${type}"][data-filter-value="${value}"]`);
    if (pill) {
      pill.classList.toggle('active');
    }

    // Sync genre filter with chart chips
    if (type === 'genres') {
      // Update showAllInChart based on whether any genres are selected
      this.showAllInChart = this.activeFilters.genres.length > 0;
      // Re-render chart filter chips to reflect the change
      this.renderChartFilters();
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

    // Update all pills
    document.querySelectorAll('.filter-pill.active').forEach(pill => {
      pill.classList.remove('active');
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
    this.resetChartPagination();
    this.renderActiveFilters();
    this.render();
  },

  /**
   * Render active filters bar
   */
  renderActiveFilters() {
    const container = document.getElementById('active-filters');
    if (!container) return;

    const allActiveFilters = [];

    Object.entries(this.activeFilters).forEach(([type, values]) => {
      values.forEach(value => {
        allActiveFilters.push({ type, value });
      });
    });

    if (allActiveFilters.length === 0) {
      container.classList.remove('visible');
      container.innerHTML = '';
      return;
    }

    container.classList.add('visible');
    container.innerHTML = `
      <span class="active-filters-label">Active Filters:</span>
      ${allActiveFilters.map(filter => `
        <span class="filter-tag">
          ${filter.value}
          <span class="filter-tag-remove" onclick="App.toggleFilter('${filter.type}', '${filter.value.replace(/'/g, "\\'")}')">&times;</span>
        </span>
      `).join('')}
      <button class="clear-all-filters" onclick="App.clearAllFilters()">Clear All</button>
    `;
  },

  /**
   * Render filter nudge when result set is large
   */
  renderFilterNudge() {
    const nudge = document.getElementById('filter-nudge');
    if (!nudge) return;

    const count = this.filteredData.length;
    const threshold = 100;
    const shouldShow = count > threshold;
    nudge.classList.toggle('visible', shouldShow);

    if (!shouldShow) return;

    const titleEl = document.getElementById('filter-nudge-title');
    const textEl = document.getElementById('filter-nudge-text');
    if (titleEl) {
      titleEl.textContent = 'Large result set';
    }
    if (textEl) {
      const suffix = this.hasActiveFilters()
        ? 'Add more filters to reveal clearer signals.'
        : 'Add filters to focus on what matters.';
      textEl.textContent = `Showing ${count} titles. ${suffix}`;
    }
  },

  /**
   * Check if any filters are active
   */
  hasActiveFilters() {
    return Object.values(this.activeFilters).some(arr => arr.length > 0);
  },

  /**
   * Render the entire dashboard
   */
  render() {
    this.renderRankings();
    this.renderRecommendations();
    this.renderAnimeGrid();
    this.renderMainChart();
    this.renderFilterNudge();
  },

  /**
   * Render recommendations section
   */
  renderRecommendations() {
    const container = document.getElementById('recommendations-grid');
    const contextEl = document.getElementById('recommendations-context');
    if (!container) return;

    // Update context text
    if (contextEl && this.currentProfile) {
      const profileNames = {
        programmer: 'Weekly Watcher',
        completionist: 'Completionist',
        escapist: 'Casual Viewer',
        focuser: 'Deep Diver'
      };
      contextEl.innerHTML = `Based on your <strong>${profileNames[this.currentProfile]}</strong> viewing style`;
    }

    // Get recommendations
    const recommendations = Recommendations.getRecommendations(
      this.filteredData,
      this.currentProfile,
      5
    );

    if (recommendations.length === 0) {
      container.innerHTML = '<p class="no-data">No recommendations available</p>';
      return;
    }

    container.innerHTML = recommendations.map(anime => `
      <div class="recommendation-card" onclick="App.showAnimeDetail('${anime.id}')">
        <img src="${anime.cover}" alt="${anime.title}" class="recommendation-cover" onerror="this.src='https://via.placeholder.com/180x120?text=No+Image'">
        <div class="recommendation-info">
          <div class="recommendation-title">${anime.title}</div>
          <div class="recommendation-reason">${anime.reason || ''}</div>
        </div>
      </div>
    `).join('');
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

    // Get profile-specific ranking config
    const rankingConfig = Recommendations.getRankingTitles(this.currentProfile);

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
    let valueDisplay = '';
    let labelDisplay = '';

    switch (metric) {
      case 'reliability':
        valueDisplay = `${anime.stats.reliabilityScore}%`;
        labelDisplay = 'consistency';
        break;
      case 'sessionSafety':
        valueDisplay = `${anime.stats.sessionSafety}%`;
        labelDisplay = 'safe watch';
        break;
      case 'peakEpisodes':
        valueDisplay = anime.stats.peakEpisodeCount;
        labelDisplay = 'standout episodes';
        break;
      case 'finaleStrength':
        valueDisplay = `${anime.stats.finaleStrength}%`;
        labelDisplay = 'ending quality';
        break;
      case 'comfort':
        valueDisplay = `${anime.stats.comfortScore}%`;
        labelDisplay = 'relaxation';
        break;
      case 'emotionalStability':
        valueDisplay = `${anime.stats.emotionalStability}%`;
        labelDisplay = 'stability';
        break;
      case 'improving':
        valueDisplay = anime.stats.qualityTrend.slope > 0 ? '+' + anime.stats.qualityTrend.slope.toFixed(2) : anime.stats.qualityTrend.slope.toFixed(2);
        labelDisplay = 'trend';
        break;
      case 'productionQuality':
        valueDisplay = `${anime.stats.productionQualityIndex}%`;
        labelDisplay = 'quality index';
        break;
      case 'average':
        valueDisplay = anime.stats.average;
        labelDisplay = 'avg score';
        break;
      case 'consistency':
        valueDisplay = anime.stats.stdDev;
        labelDisplay = 'score spread';
        break;

      // ---- RETENTION METRICS ----
      case 'threeEpisodeHook':
        valueDisplay = `${anime.stats.threeEpisodeHook}%`;
        labelDisplay = 'hook strength';
        break;
      case 'churnRisk':
        valueDisplay = `${anime.stats.churnRisk.score}%`;
        labelDisplay = 'drop risk';
        break;
      case 'momentum':
        valueDisplay = anime.stats.momentum > 0 ? `+${anime.stats.momentum}` : `${anime.stats.momentum}`;
        labelDisplay = 'momentum';
        break;
      case 'narrativeAcceleration':
        valueDisplay = anime.stats.narrativeAcceleration > 0 ? `+${anime.stats.narrativeAcceleration.toFixed(2)}` : anime.stats.narrativeAcceleration.toFixed(2);
        labelDisplay = 'acceleration';
        break;
      case 'flowState':
        valueDisplay = `${anime.stats.flowState}%`;
        labelDisplay = 'flow score';
        break;
      case 'barrierToEntry':
        valueDisplay = anime.stats.barrierToEntry.toFixed(2);
        labelDisplay = 'entry barrier';
        break;
      case 'controversyPotential':
        valueDisplay = `${anime.stats.controversyPotential}%`;
        labelDisplay = 'controversy';
        break;
      case 'sharkJump':
        valueDisplay = anime.stats.sharkJump ? `Ep ${anime.stats.sharkJump.episode}` : 'None';
        labelDisplay = 'shark jump';
        break;

      default:
        valueDisplay = anime.stats.average;
        labelDisplay = 'avg score';
    }

    return `
      <div class="ranking-anime">
        <img src="${anime.cover}" alt="${anime.title}" class="ranking-cover" onerror="this.src='https://via.placeholder.com/60x85?text=No+Image'">
        <div class="ranking-info">
          <div class="ranking-title">${anime.title}</div>
          <div class="ranking-score ${anime.stats.scoreClass}">
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
  renderAnimeGrid() {
    const container = document.getElementById('anime-grid');
    if (!container) return;

    const sorted = this.sortAnimeByMetric(this.filteredData, this.currentSort, this.sortDirection);

    if (sorted.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <h3>No anime found</h3>
          <p>Try adjusting your filters to see more results.</p>
        </div>
      `;
      return;
    }

    // Pagination: show only current page items
    const startIndex = 0;
    const endIndex = this.gridCurrentPage * this.gridPageSize;
    const visibleAnime = sorted.slice(startIndex, endIndex);
    const hasMore = endIndex < sorted.length;

    container.innerHTML = visibleAnime.map((anime, index) => {
      // Get profile-specific badges and stats
      const badges = Recommendations.getBadges(anime, this.currentProfile);
      const cardStats = Recommendations.getCardStats(anime, this.currentProfile);

      return `
        <div class="anime-card ${this.selectedAnime.includes(anime.id) ? 'selected' : ''}"
             data-id="${anime.id}"
             onclick="App.handleCardClick('${anime.id}')">
          <div class="card-header">
            <img src="${anime.cover}" alt="${anime.title}" class="card-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/120x170?text=No+Image'">
            <div class="card-sparkline">
              <canvas id="sparkline-${anime.id}" width="100" height="40"></canvas>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-title">${anime.title}</h3>
            <div class="card-year">${anime.year || 'Unknown'} &bull; ${anime.studio || 'Unknown'}</div>
            ${badges.length > 0 ? `
              <div class="card-badges">
                ${badges.map(b => `<span class="card-badge ${b.class}">${b.label}</span>`).join('')}
              </div>
            ` : ''}
            <div class="card-stats">
              ${cardStats.map(stat => `
                <div class="stat">
                  <span class="stat-value ${stat.class || ''}">${stat.value}${stat.suffix || ''}</span>
                  <span class="stat-label">${stat.label}</span>
                </div>
              `).join('')}
            </div>
            <div class="card-badge ${anime.stats.consistency.class}">
              ${anime.stats.consistency.label}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add "Load More" button if there are more items
    if (hasMore) {
      container.innerHTML += `
        <div class="load-more-container">
          <button class="load-more-btn" onclick="App.loadMoreAnime()">
            Load More (${sorted.length - endIndex} remaining)
          </button>
        </div>
      `;
    }

    // Create sparklines after DOM is updated (only for visible cards)
    requestAnimationFrame(() => {
      visibleAnime.forEach((anime) => {
        this.createSparkline(anime);
      });
    });
  },

  /**
   * Load more anime cards
   */
  loadMoreAnime() {
    this.gridCurrentPage++;
    this.renderAnimeGrid();
  },

  /**
   * Reset pagination when filters change
   */
  resetGridPagination() {
    this.gridCurrentPage = 1;
  },

  /**
   * Create sparkline chart for an anime card
   */
  createSparkline(anime) {
    const canvasId = `sparkline-${anime.id}`;

    // Destroy existing chart if any
    if (this.sparklineCharts[anime.id]) {
      this.sparklineCharts[anime.id].destroy();
    }

    this.sparklineCharts[anime.id] = Charts.createSparkline(
      canvasId,
      anime.episodes,
      anime.colorIndex
    );
  },

  /**
   * Get the sort key for the current profile's main chart
   * @param {string} profile - Profile key
   * @returns {string} Sort key for Stats.rankAnime
   */
  getProfileSortKey(profile) {
    const profileSorts = {
      programmer: 'reliability',
      completionist: 'worthFinishing',
      escapist: 'comfort',
      focuser: 'productionQuality'
    };
    return profileSorts[profile] || 'average';
  },

  /**
   * Sort anime list by metric with explicit direction
   * @param {Array} animeList - Array of anime
   * @param {string} metricKey - Sort metric key
   * @param {string} direction - 'asc' or 'desc'
   * @returns {Array} Sorted array
   */
  sortAnimeByMetric(animeList, metricKey, direction = 'desc') {
    const list = [...animeList];
    const metricConfig = Charts.getMetricConfig(metricKey);
    const maxEpisodes = list.reduce((max, anime) => {
      const count = Array.isArray(anime.episodes) ? anime.episodes.length : 0;
      return Math.max(max, count);
    }, 0);
    const dirMultiplier = direction === 'asc' ? 1 : -1;
    const metricMultiplier = metricConfig?.lowerIsBetter ? -1 : 1;
    const effectiveMultiplier = dirMultiplier * metricMultiplier;

    list.sort((a, b) => {
      const aVal = Charts.getMetricValue(a, metricConfig, { maxEpisodes });
      const bVal = Charts.getMetricValue(b, metricConfig, { maxEpisodes });
      if (aVal === bVal) return 0;
      return (aVal < bVal ? -1 : 1) * effectiveMultiplier;
    });

    return list;
  },

  /**
   * Get the chart data source based on compare mode and filters
   * @returns {Array} Anime list for chart rendering
   */
  getChartDataSource() {
    if (this.compareMode && this.selectedAnime.length > 0) {
      return this.filteredData.filter(a => this.selectedAnime.includes(a.id));
    }
    return this.filteredData;
  },

  /**
   * Slice chart data for pagination
   * @param {Array} sortedList - Sorted anime list
   * @returns {Array} Windowed list for chart
   */
  getChartWindow(sortedList) {
    if (this.compareMode && this.selectedAnime.length > 0) {
      return sortedList;
    }

    const maxOffset = Math.max(0, sortedList.length - this.chartLimit);
    this.chartOffset = Math.min(this.chartOffset, maxOffset);
    this.chartOffset = Math.max(0, this.chartOffset);

    return sortedList.slice(this.chartOffset, this.chartOffset + this.chartLimit);
  },

  /**
   * Render main bar chart for profile metrics
   */
  renderMainChart() {
    const dataSource = this.getChartDataSource();
    const profileSortKey = this.getProfileSortKey(this.currentProfile);

    const mainSorted = this.sortAnimeByMetric(dataSource, profileSortKey, this.sortDirection);
    const mainWindow = this.getChartWindow(mainSorted);

    // Create bar chart with profile metric
    Charts.createMainBarChart('main-chart', mainWindow, this.currentProfile);

    // Create sort-metric chart based on current "sort by" selection
    const sortMetricConfig = Charts.getMetricConfig(this.currentSort);
    const sortSorted = this.sortAnimeByMetric(dataSource, this.currentSort, this.sortDirection);
    const sortWindow = this.getChartWindow(sortSorted);
    Charts.createMetricBarChart('sort-chart', sortWindow, sortMetricConfig, 'sortChart');

    // Update chart title based on profile
    this.updateChartTitle();
    this.updateSortChartTitle(sortMetricConfig);

    // Render filter chips
    this.renderChartFilters();

    // Update chart info display with pagination info
    this.updateChartInfo(mainWindow.length, mainSorted.length);

    // Update navigation buttons
    this.updateChartNavigation(mainSorted.length);
  },

  /**
   * Navigate chart to the left (previous items)
   */
  chartNavigateLeft() {
    if (this.compareMode && this.selectedAnime.length > 0) return;
    this.chartOffset = Math.max(0, this.chartOffset - this.chartLimit);
    this.renderMainChart();
  },

  /**
   * Navigate chart to the right (next items)
   */
  chartNavigateRight() {
    if (this.compareMode && this.selectedAnime.length > 0) return;
    const total = this.getChartDataSource().length;
    const maxOffset = Math.max(0, total - this.chartLimit);
    this.chartOffset = Math.min(maxOffset, this.chartOffset + this.chartLimit);
    this.renderMainChart();
  },

  /**
   * Reset chart pagination
   */
  resetChartPagination() {
    this.chartOffset = 0;
  },

  /**
   * Update chart navigation buttons visibility
   */
  updateChartNavigation(total) {
    const navPairs = [
      { left: 'chart-nav-left', right: 'chart-nav-right' },
      { left: 'sort-chart-nav-left', right: 'sort-chart-nav-right' }
    ];

    if (this.compareMode && this.selectedAnime.length > 0) {
      navPairs.forEach(({ left, right }) => {
        const navLeft = document.getElementById(left);
        const navRight = document.getElementById(right);
        if (navLeft) navLeft.style.display = 'none';
        if (navRight) navRight.style.display = 'none';
      });
      return;
    }

    const hasMore = this.chartOffset + this.chartLimit < total;
    navPairs.forEach(({ left, right }) => {
      const navLeft = document.getElementById(left);
      const navRight = document.getElementById(right);
      if (navLeft) {
        navLeft.style.display = this.chartOffset > 0 ? 'flex' : 'none';
      }
      if (navRight) {
        navRight.style.display = hasMore ? 'flex' : 'none';
      }
    });
  },

  /**
   * Update the main chart title based on current profile
   */
  updateChartTitle() {
    const titleEl = document.getElementById('main-chart-title');
    const defEl = document.getElementById('chart-definition');
    const infoEl = document.getElementById('main-chart-info');
    const directionEl = document.getElementById('main-chart-direction');
    if (!titleEl) return;

    const metricConfig = Charts.getMetricForProfile(this.currentProfile);
    titleEl.textContent = metricConfig.label;

    const profileSortKey = this.getProfileSortKey(this.currentProfile);
    const directionConfig = Charts.getMetricConfig(profileSortKey);
    const lowerIsBetter = directionConfig?.lowerIsBetter;
    this.setMetricDirectionBadge(directionEl, lowerIsBetter);

    const definition = Charts.getMetricDefinition(this.currentProfile);
    const fallbackDefinition = definition || Charts.getMetricDescription(metricConfig.key);
    if (defEl) {
      defEl.textContent = fallbackDefinition;
    }

    const example = this.currentProfile
      ? this.getProfileMetricExample(this.currentProfile)
      : this.getMetricExample(metricConfig.key);
    const note = lowerIsBetter ? 'Lower is better.' : 'Higher is better.';
    const tooltipText = this.buildTooltipText(fallbackDefinition, example, note);
    this.setTooltipText(infoEl, tooltipText);
  },

  /**
   * Update the sort-based chart title and definition
   */
  updateSortChartTitle(metricConfig = null) {
    const titleEl = document.getElementById('sort-chart-title');
    const defEl = document.getElementById('sort-chart-definition');
    const infoEl = document.getElementById('sort-chart-info');
    const directionEl = document.getElementById('sort-chart-direction');
    if (!titleEl) return;

    const config = metricConfig || Charts.getMetricConfig(this.currentSort);
    titleEl.textContent = config.label;
    const description = Charts.getMetricDescription(this.currentSort);
    if (defEl) {
      defEl.textContent = description;
    }

    const example = this.getMetricExample(this.currentSort);
    const note = config?.lowerIsBetter ? 'Lower is better.' : 'Higher is better.';
    this.setMetricDirectionBadge(directionEl, config?.lowerIsBetter);
    const tooltipText = this.buildTooltipText(description, example, note);
    this.setTooltipText(infoEl, tooltipText);
  },

  /**
   * Render filter chips for the main bar chart
   */
  renderChartFilters() {
    const container = document.getElementById('chart-filters');
    if (!container) return;

    // Get data source for genre chips - use data filtered by everything EXCEPT genres
    // This ensures all genre chips remain visible even when some are selected
    const dataForGenreChips = this.animeData.filter(anime => {
      // Apply all filters except genres
      if (this.activeFilters.seasonYear.length > 0) {
        const animeSeasonYear = `${anime.season} ${anime.year}`;
        if (!this.activeFilters.seasonYear.includes(animeSeasonYear)) return false;
      }
      if (this.activeFilters.year.length > 0) {
        if (!this.activeFilters.year.includes(String(anime.year))) return false;
      }
      if (this.activeFilters.studio.length > 0) {
        const animeStudios = Array.isArray(anime.studio) ? anime.studio : [anime.studio];
        if (!animeStudios.some(s => this.activeFilters.studio.includes(s))) return false;
      }
      if (this.activeFilters.source.length > 0) {
        if (!this.activeFilters.source.includes(anime.source)) return false;
      }
      if (this.activeFilters.themes.length > 0) {
        if (!anime.themes || !this.activeFilters.themes.every(t => anime.themes.includes(t))) return false;
      }
      if (this.activeFilters.demographic.length > 0) {
        if (!this.activeFilters.demographic.includes(anime.demographic)) return false;
      }
      return true;
    });

    // Get unique genres sorted by frequency
    const genreCounts = {};
    dataForGenreChips.forEach(a => {
      (a.genres || []).forEach(g => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });
    const genres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([genre]) => genre);

    // Get data source for theme chips - use data filtered by everything EXCEPT themes
    const dataForThemeChips = this.animeData.filter(anime => {
      if (this.activeFilters.seasonYear.length > 0) {
        const animeSeasonYear = `${anime.season} ${anime.year}`;
        if (!this.activeFilters.seasonYear.includes(animeSeasonYear)) return false;
      }
      if (this.activeFilters.year.length > 0) {
        if (!this.activeFilters.year.includes(String(anime.year))) return false;
      }
      if (this.activeFilters.studio.length > 0) {
        const animeStudios = Array.isArray(anime.studio) ? anime.studio : [anime.studio];
        if (!animeStudios.some(s => this.activeFilters.studio.includes(s))) return false;
      }
      if (this.activeFilters.source.length > 0) {
        if (!this.activeFilters.source.includes(anime.source)) return false;
      }
      if (this.activeFilters.genres.length > 0) {
        if (!anime.genres || !this.activeFilters.genres.every(g => anime.genres.includes(g))) return false;
      }
      if (this.activeFilters.demographic.length > 0) {
        if (!this.activeFilters.demographic.includes(anime.demographic)) return false;
      }
      return true;
    });

    const themeCounts = {};
    dataForThemeChips.forEach(a => {
      (a.themes || []).forEach(t => {
        themeCounts[t] = (themeCounts[t] || 0) + 1;
      });
    });
    const themes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);

    // Check if any genres are selected
    const hasGenreFilters = this.activeFilters.genres.length > 0;

    const genreChips = [
      { label: 'Top 20', value: 'top20', active: !hasGenreFilters },
      ...genres.map(g => ({
        label: g,
        value: `genre:${g}`,
        active: this.activeFilters.genres.includes(g)
      }))
    ];

    const themeChips = themes.map(t => ({
      label: t,
      value: `theme:${t}`,
      active: this.activeFilters.themes.includes(t)
    }));

    container.innerHTML = `
      <div class="chart-filter-row">
        <span class="chart-filter-label">Genres</span>
        <div class="chart-filter-scroll">
          ${genreChips.map(chip => `
            <button class="chart-filter-chip ${chip.active ? 'active' : ''}"
                    data-filter="${chip.value}"
                    onclick="App.handleChartFilterClick('${chip.value.replace(/'/g, "\\'")}')">
              ${chip.label}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="chart-filter-row">
        <span class="chart-filter-label">Themes</span>
        <div class="chart-filter-scroll">
          ${themeChips.map(chip => `
            <button class="chart-filter-chip ${chip.active ? 'active' : ''}"
                    data-filter="${chip.value}"
                    onclick="App.handleChartFilterClick('${chip.value.replace(/'/g, "\\'")}')">
              ${chip.label}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Handle chart filter chip click - supports multiple genre selection
   */
  handleChartFilterClick(filterValue) {
    if (filterValue === 'top20') {
      // Top 20 clears all genre filters and resets to first page
      this.activeFilters.genres = [];
      this.chartOffset = 0;
    } else if (filterValue.startsWith('genre:')) {
      const genre = filterValue.replace('genre:', '');

      // Toggle genre in activeFilters array (multi-select)
      const index = this.activeFilters.genres.indexOf(genre);
      if (index > -1) {
        this.activeFilters.genres.splice(index, 1);
      } else {
        this.activeFilters.genres.push(genre);
      }

      // Reset to first page when genres change
      this.chartOffset = 0;
    } else if (filterValue.startsWith('theme:')) {
      const theme = filterValue.replace('theme:', '');
      const index = this.activeFilters.themes.indexOf(theme);
      if (index > -1) {
        this.activeFilters.themes.splice(index, 1);
      } else {
        this.activeFilters.themes.push(theme);
      }

      // Reset to first page when themes change
      this.chartOffset = 0;
    }

    // Update modal pills UI to sync with chip selection
    document.querySelectorAll('[data-filter-type="genres"]').forEach(pill => {
      const pillGenre = pill.dataset.filterValue;
      pill.classList.toggle('active', this.activeFilters.genres.includes(pillGenre));
    });
    document.querySelectorAll('[data-filter-type="themes"]').forEach(pill => {
      const pillTheme = pill.dataset.filterValue;
      pill.classList.toggle('active', this.activeFilters.themes.includes(pillTheme));
    });

    // Apply filters and re-render everything (including chart and chips)
    this.applyFilters();
  },

  /**
   * Update chart info display
   */
  updateChartInfo(showing, total) {
    const chartInfo = document.getElementById('chart-info');
    const chartLimitToggle = document.getElementById('chart-limit-toggle');

    if (chartInfo) {
      if (this.compareMode && this.selectedAnime.length > 0) {
        chartInfo.textContent = `Comparing ${showing} anime`;
      } else if (total > this.chartLimit) {
        // Show range when paginated
        const start = this.chartOffset + 1;
        const end = Math.min(this.chartOffset + this.chartLimit, total);
        chartInfo.textContent = `Showing ${start}-${end} of ${total} anime`;
      } else {
        chartInfo.textContent = `Showing all ${total} anime`;
      }
    }

    if (chartLimitToggle) {
      // Hide the old toggle since we now have navigation
      chartLimitToggle.style.display = 'none';
    }
  },

  /**
   * Handle card click
   */
  handleCardClick(animeId) {
    if (this.compareMode) {
      this.toggleAnimeSelection(animeId);
    } else {
      this.showAnimeDetail(animeId);
    }
  },

  /**
   * Toggle anime selection for comparison
   */
  toggleAnimeSelection(animeId) {
    const index = this.selectedAnime.indexOf(animeId);
    if (index > -1) {
      this.selectedAnime.splice(index, 1);
    } else {
      this.selectedAnime.push(animeId);
    }

    // Update card selection state
    const card = document.querySelector(`.anime-card[data-id="${animeId}"]`);
    if (card) {
      card.classList.toggle('selected');
    }

    // Update chart and comparison table
    this.renderMainChart();
    this.renderComparisonTable();
    this.updateCompareCount();
  },

  /**
   * Toggle compare mode
   */
  toggleCompareMode() {
    this.compareMode = !this.compareMode;
    this.updateCompareModeUI();

    if (!this.compareMode) {
      // Clear selections when exiting compare mode
      this.selectedAnime = [];
      document.querySelectorAll('.anime-card.selected').forEach(card => {
        card.classList.remove('selected');
      });

      const comparisonSection = document.getElementById('comparison-section');
      if (comparisonSection) {
        comparisonSection.classList.remove('visible');
      }

      this.renderMainChart();
    }

    this.renderComparisonTable();
    this.updateCompareCount();
    this.updateSelectedAnimeCount();
  },

  /**
   * Update compare mode UI elements
   */
  updateCompareModeUI() {
    const compareBanner = document.getElementById('compare-mode-banner');

    if (compareBanner) {
      compareBanner.classList.toggle('visible', this.compareMode);
    }
  },

  /**
   * Clear all anime selections
   */
  clearAnimeSelection() {
    this.selectedAnime = [];
    document.querySelectorAll('.anime-card.selected').forEach(card => {
      card.classList.remove('selected');
    });
    this.renderMainChart();
    this.renderComparisonTable();
    this.updateCompareCount();
  },

  /**
   * Update compare count display
   */
  updateCompareCount() {
    const countEl = document.getElementById('compare-count');
    const countBadge = document.getElementById('compare-count-badge');
    const count = this.selectedAnime.length;

    if (countEl) {
      countEl.textContent = `${count} selected`;
    }

    if (countBadge) {
      countBadge.textContent = `${count} selected`;
    }
  },

  /**
   * Render the comparison table for selected anime
   */
  renderComparisonTable() {
    const section = document.getElementById('comparison-section');
    const container = document.getElementById('comparison-table');

    if (!section || !container) return;

    // Show/hide section based on compare mode and selection
    if (!this.compareMode || this.selectedAnime.length === 0) {
      section.classList.remove('visible');
      return;
    }

    section.classList.add('visible');

    const selectedAnimeData = this.filteredData.filter(a =>
      this.selectedAnime.includes(a.id)
    );

    if (selectedAnimeData.length === 0) {
      container.innerHTML = '<p class="no-selection">Select anime cards to compare</p>';
      return;
    }

    // Build comparison table based on current profile
    const metrics = this.getComparisonMetrics();

    container.innerHTML = `
      <table class="comparison-table">
        <thead>
          <tr>
            <th class="metric-header">Metric</th>
            ${selectedAnimeData.map(anime => `
              <th class="anime-header">
                <div class="anime-header-content">
                  <img src="${anime.cover}" alt="${anime.title}" class="comparison-cover"
                       onerror="this.src='https://via.placeholder.com/40x56?text=No+Image'">
                  <span class="comparison-title">${anime.title}</span>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          ${metrics.map(metric => this.renderComparisonRow(metric, selectedAnimeData)).join('')}
        </tbody>
      </table>
    `;
  },

  /**
   * Get comparison metrics based on current profile
   */
  getComparisonMetrics() {
    const coreMetrics = [
      { key: 'average', label: 'Average Score', format: (v) => v.toFixed(2), highlight: 'high' },
      { key: 'auc', label: 'Overall Score', format: (v) => `${v}%`, highlight: 'high' },
      { key: 'stdDev', label: 'Score Spread', format: (v) => v.toFixed(2), highlight: 'low' },
      { key: 'episodeCount', label: 'Episodes', format: (v) => v, highlight: 'none' },
    ];

    const profileMetrics = {
      programmer: [
        { key: 'threeEpisodeHook', label: 'Hook Strength', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'churnRisk', label: 'Drop Risk', format: (v) => `${v.score}%`, highlight: 'low', isObject: true },
        { key: 'habitBreakRisk', label: 'Habit Break Chain', format: (v) => v, highlight: 'low' },
        { key: 'reliabilityScore', label: 'Consistency', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'sessionSafety', label: 'Safe Watch Rating', format: (v) => `${v}%`, highlight: 'high' },
      ],
      completionist: [
        { key: 'momentum', label: 'Momentum', format: (v) => v > 0 ? `+${v}` : v, highlight: 'high' },
        { key: 'narrativeAcceleration', label: 'Story Acceleration', format: (v) => v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2), highlight: 'high' },
        { key: 'peakEpisodeCount', label: 'Standout Episodes', format: (v) => v, highlight: 'high' },
        { key: 'finaleStrength', label: 'Ending Quality', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'worthFinishing', label: 'Completion Value', format: (v) => `${v}%`, highlight: 'high' },
      ],
      escapist: [
        { key: 'flowState', label: 'Flow State', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'barrierToEntry', label: 'Entry Barrier', format: (v) => v.toFixed(2), highlight: 'low' },
        { key: 'comfortScore', label: 'Relaxation', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'emotionalStability', label: 'Mood Stability', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'stressSpikes', label: 'Tension Moments', format: (v) => v, highlight: 'low' },
      ],
      focuser: [
        { key: 'controversyPotential', label: 'Controversy', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'sharkJump', label: 'Shark Jump', format: (v) => v ? `Ep ${v.episode}` : 'None', highlight: 'none', isObject: true },
        { key: 'productionQualityIndex', label: 'Quality Index', format: (v) => `${v}%`, highlight: 'high' },
        { key: 'qualityTrend', label: 'Trend Direction', format: (v) => v.slope > 0 ? `+${v.slope.toFixed(2)}` : v.slope.toFixed(2), highlight: 'high', isObject: true },
        { key: 'qualityDips', label: 'Weak Episodes', format: (v) => v.length, highlight: 'low', isObject: true },
      ]
    };

    return [...coreMetrics, ...(profileMetrics[this.currentProfile] || [])];
  },

  /**
   * Render a single comparison row
   */
  renderComparisonRow(metric, animeList) {
    const values = animeList.map(anime => {
      const value = anime.stats[metric.key];
      return value;
    });

    // Find best value for highlighting
    let bestIndex = -1;
    if (metric.highlight === 'high') {
      const numericValues = values.map(v => {
        if (metric.isObject && v && typeof v === 'object') {
          return v.slope !== undefined ? v.slope : (v.length !== undefined ? -v.length : 0);
        }
        return typeof v === 'number' ? v : 0;
      });
      const maxVal = Math.max(...numericValues);
      bestIndex = numericValues.indexOf(maxVal);
    } else if (metric.highlight === 'low') {
      const numericValues = values.map(v => {
        if (metric.isObject && v && typeof v === 'object') {
          return v.length !== undefined ? v.length : 0;
        }
        return typeof v === 'number' ? v : 0;
      });
      const minVal = Math.min(...numericValues);
      bestIndex = numericValues.indexOf(minVal);
    }

    return `
      <tr>
        <td class="metric-name">${metric.label}</td>
        ${values.map((value, index) => `
          <td class="metric-value ${index === bestIndex ? 'best-value' : ''}">
            ${metric.format(value)}
          </td>
        `).join('')}
      </tr>
    `;
  },

  /**
   * Show anime detail modal
   */
  showAnimeDetail(animeId) {
    const anime = this.animeData.find(a => a.id === animeId);
    if (!anime) return;

    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');

    if (!modal || !content) return;

    // Build genres and themes tags
    const genreTags = anime.genres && anime.genres.length > 0
      ? anime.genres.map(g => `<span class="detail-tag">${g}</span>`).join('')
      : '';
    const themeTags = anime.themes && anime.themes.length > 0
      ? anime.themes.map(t => `<span class="detail-tag">${t}</span>`).join('')
      : '';

    // Get profile-specific analysis section
    const profileAnalysis = this.getProfileAnalysisSection(anime);
    const trailerSection = this.renderTrailerSection(anime);

    const metaParts = [anime.year, anime.studio, anime.source, anime.demographic]
      .map(value => {
        const label = String(value ?? '').trim();
        const normalized = label.toLowerCase();
        if (!label || normalized === 'undefined' || normalized === 'null') return '';
        return label;
      })
      .filter(Boolean);
    const metaHtml = metaParts.map(part => `<span>${part}</span>`).join(' &bull; ');

    content.innerHTML = `
      <div class="detail-header">
        <img src="${anime.cover}" alt="${anime.title}" class="detail-cover" onerror="this.src='https://via.placeholder.com/150x210?text=No+Image'">
        <div class="detail-info">
          <h2 class="detail-title">${anime.title}</h2>
          <div class="detail-meta">
            ${metaHtml}
          </div>
          <div class="detail-tags">
            ${genreTags}${themeTags}
          </div>
          <div class="detail-stats">
            <div class="detail-stat">
              <span class="detail-stat-value ${anime.stats.scoreClass}">${anime.stats.average}</span>
              <span class="detail-stat-label">Average Score</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${anime.stats.auc}%</span>
              <span class="detail-stat-label">Overall Score</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${anime.stats.stdDev}</span>
              <span class="detail-stat-label">Score Spread</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${anime.stats.episodeCount}</span>
              <span class="detail-stat-label">Episodes</span>
            </div>
          </div>
          <div class="detail-badge ${anime.stats.consistency.class}">
            ${anime.stats.consistency.label}
          </div>
        </div>
      </div>
      <div id="synopsis-section">
        ${ReviewsService.renderSynopsisLoading()}
      </div>
      ${trailerSection}
      <div class="detail-chart-container">
        <h3>Episode Scores</h3>
        <div class="detail-chart-wrapper">
          <canvas id="detail-chart"></canvas>
        </div>
      </div>
      ${profileAnalysis}
      <div id="community-reviews-section">
        ${ReviewsService.renderLoading()}
      </div>
    `;

    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Create detail chart after modal is visible
    requestAnimationFrame(() => {
      Charts.createDetailChart('detail-chart', anime, anime.colorIndex);
    });

    // Load community reviews
    this.loadCommunityReviews(anime);
  },

  /**
   * Load community reviews and synopsis from AniList
   */
  async loadCommunityReviews(anime) {
    const reviewsSection = document.getElementById('community-reviews-section');
    const synopsisSection = document.getElementById('synopsis-section');

    try {
      const data = await ReviewsService.fetchReviews(anime.anilistId, anime.title);

      // Update synopsis section
      if (synopsisSection) {
        synopsisSection.innerHTML = ReviewsService.renderSynopsis(data.description);
      }

      // Update reviews section
      if (reviewsSection) {
        reviewsSection.innerHTML = ReviewsService.renderReviewsSection(data, 'positive');
        ReviewsService.initTabSwitching(data);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);

      // Clear synopsis loading state on error
      if (synopsisSection) {
        synopsisSection.innerHTML = '';
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
   * Get profile-specific analysis section for detail modal
   */
  getProfileAnalysisSection(anime) {
    if (!this.currentProfile) return '';

    switch (this.currentProfile) {
      case 'programmer':
        return this.getProgrammerAnalysis(anime);
      case 'completionist':
        return this.getCompletionistAnalysis(anime);
      case 'escapist':
        return this.getEscapistAnalysis(anime);
      case 'focuser':
        return this.getFocuserAnalysis(anime);
      default:
        return '';
    }
  },

  /**
   * Programmer analysis section
   */
  getProgrammerAnalysis(anime) {
    const riskLevel = 100 - anime.stats.sessionSafety;
    const riskClass = riskLevel < 20 ? 'low' : riskLevel < 50 ? 'medium' : 'high';
    const riskLabel = riskLevel < 20 ? 'Low Risk' : riskLevel < 50 ? 'Medium Risk' : 'High Risk';

    const safeMessage = anime.stats.sessionSafety === 100
      ? 'All episodes maintain quality. Safe for any session.'
      : anime.stats.lowestScore >= 3
        ? 'No episodes below threshold. Reliable viewing experience.'
        : `Warning: ${anime.episodes.filter(e => e.score < 3).length} episode(s) below quality threshold.`;

    const churnRisk = anime.stats.churnRisk;
    const churnClass = churnRisk.score < 20 ? 'low' : churnRisk.score < 50 ? 'moderate' : churnRisk.score < 80 ? 'high' : 'critical';

    return `
      <div class="profile-analysis programmer-analysis">
        <h3>Session Risk Analysis</h3>
        <div class="risk-indicator">
          <div class="risk-meter">
            <div class="risk-meter-fill ${riskClass}" style="width: ${riskLevel}%"></div>
          </div>
          <span class="risk-label">${riskLabel} - ${anime.stats.reliabilityScore}% Reliability Score</span>
        </div>
        <div class="safe-episodes">
          ${safeMessage}
        </div>

        <div class="retention-analysis">
          <h4>Retention Analysis</h4>
          <div class="retention-metric">
            <span class="label">Hook Strength (First 3 Eps):</span>
            <span class="value">${anime.stats.threeEpisodeHook}%</span>
          </div>
          <div class="retention-metric">
            <span class="label">Drop Risk:</span>
            <span class="value ${churnClass}">${churnRisk.label} (${churnRisk.score}%)</span>
          </div>
          ${churnRisk.factors.length > 0 ? `
            <ul class="risk-factors">
              ${churnRisk.factors.map(f => `<li>${f}</li>`).join('')}
            </ul>
          ` : ''}
          <div class="retention-metric">
            <span class="label">Habit Break Risk:</span>
            <span class="value">${anime.stats.habitBreakRisk} consecutive below-median episodes</span>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Completionist analysis section
   */
  getCompletionistAnalysis(anime) {
    const finaleClass = anime.stats.finaleStrength >= 55 ? 'strong' : anime.stats.finaleStrength <= 45 ? 'weak' : 'neutral';
    const momentumClass = anime.stats.momentum > 20 ? 'positive' : anime.stats.momentum < -20 ? 'negative' : 'neutral';
    const momentumArrow = anime.stats.momentum > 0 ? '↑' : anime.stats.momentum < 0 ? '↓' : '→';

    return `
      <div class="profile-analysis completionist-analysis">
        <h3>Peak Moments Timeline</h3>
        <div class="peak-timeline">
          ${anime.episodes.map(ep => `
            <div class="episode-marker ${ep.score === 5 ? 'peak' : ''}" title="Ep ${ep.episode}: ${ep.score}/5"></div>
          `).join('')}
        </div>
        <div class="finale-analysis">
          <h4>Finale Strength: ${anime.stats.finaleStrength}%</h4>
          <div class="finale-meter">
            <div class="finale-meter-fill ${finaleClass}" style="width: ${anime.stats.finaleStrength}%"></div>
          </div>
        </div>
        <p style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
          ${anime.stats.peakEpisodeCount} peak episode(s) | Worth Finishing Score: ${anime.stats.worthFinishing}%
        </p>

        <div class="retention-analysis">
          <h4>Retention Analysis</h4>
          <div class="retention-metric">
            <span class="label">Momentum:</span>
            <span class="momentum-indicator ${momentumClass}">
              <span class="momentum-arrow ${momentumClass}">${momentumArrow}</span>
              ${anime.stats.momentum > 0 ? '+' : ''}${anime.stats.momentum}
            </span>
          </div>
          <div class="retention-metric">
            <span class="label">Narrative Acceleration:</span>
            <span class="value">${anime.stats.narrativeAcceleration > 0 ? '+' : ''}${anime.stats.narrativeAcceleration.toFixed(2)}</span>
          </div>
          <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">
            ${anime.stats.momentum > 20 ? 'Building steam - high retention likely!' :
              anime.stats.momentum < -20 ? 'Losing momentum - drop risk increasing.' :
              'Steady pacing - consistent retention.'}
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Escapist analysis section
   */
  getEscapistAnalysis(anime) {
    // Find stress-free stretches
    let stretches = [];
    let currentStretch = { start: 1, end: 1 };

    for (let i = 1; i < anime.episodes.length; i++) {
      const drop = anime.episodes[i - 1].score - anime.episodes[i].score;
      if (drop < 2) {
        currentStretch.end = anime.episodes[i].episode;
      } else {
        if (currentStretch.end - currentStretch.start >= 2) {
          stretches.push({ ...currentStretch });
        }
        currentStretch = { start: anime.episodes[i].episode, end: anime.episodes[i].episode };
      }
    }
    if (currentStretch.end - currentStretch.start >= 2) {
      stretches.push(currentStretch);
    }

    const stretchText = stretches.length > 0
      ? stretches.map(s => s.start === s.end ? `Ep ${s.start}` : `Ep ${s.start}-${s.end}`).join(', ')
      : 'Entire series is stress-free';

    const barrierClass = anime.stats.barrierToEntry < 0.5 ? 'low' : anime.stats.barrierToEntry < 1.0 ? 'medium' : 'high';

    return `
      <div class="profile-analysis escapist-analysis">
        <h3>Comfort Profile</h3>
        <div class="comfort-visual">
          <div class="emotional-range" style="opacity: ${anime.stats.comfortScore / 100}"></div>
        </div>
        <div style="display: flex; gap: 2rem; margin-bottom: 1rem;">
          <div>
            <strong style="color: var(--escapist-primary)">${anime.stats.comfortScore}%</strong>
            <span style="color: var(--text-secondary); font-size: 0.875rem;"> Comfort Score</span>
          </div>
          <div>
            <strong style="color: var(--escapist-primary)">${anime.stats.emotionalStability}%</strong>
            <span style="color: var(--text-secondary); font-size: 0.875rem;"> Emotional Stability</span>
          </div>
          <div>
            <strong style="color: ${anime.stats.stressSpikes > 0 ? 'var(--warning)' : 'var(--success)'}">${anime.stats.stressSpikes}</strong>
            <span style="color: var(--text-secondary); font-size: 0.875rem;"> Stress Spikes</span>
          </div>
        </div>
        <div class="stress-free-stretches">
          Stress-free stretches: ${stretchText}
        </div>

        <div class="retention-analysis">
          <h4>Retention Analysis</h4>
          <div class="retention-metric">
            <span class="label">Flow State:</span>
            <span class="value">${anime.stats.flowState}%</span>
          </div>
          <div class="flow-meter">
            <div class="flow-meter-fill" style="width: ${anime.stats.flowState}%"></div>
          </div>
          <div class="retention-metric" style="margin-top: 0.75rem;">
            <span class="label">Barrier to Entry:</span>
            <span class="value ${barrierClass}">${anime.stats.barrierToEntry.toFixed(2)}</span>
          </div>
          <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">
            ${anime.stats.barrierToEntry < 0.5 ? 'Smooth start - easy to get into!' :
              anime.stats.barrierToEntry < 1.0 ? 'Moderate entry - may need a few episodes to settle.' :
              'Rocky start - requires patience to get going.'}
          </p>
        </div>
      </div>
    `;
  },

  /**
   * Focuser analysis section
   */
  getFocuserAnalysis(anime) {
    const trendIcon = anime.stats.qualityTrend.direction === 'improving' ? '↑' :
      anime.stats.qualityTrend.direction === 'declining' ? '↓' : '→';

    const dipsText = anime.stats.qualityDips.length > 0
      ? anime.stats.qualityDips.map(d => `Ep ${d.episode} (${d.score}/5)`).join(', ')
      : 'None detected';

    const sharkJump = anime.stats.sharkJump;

    return `
      <div class="profile-analysis focuser-analysis">
        <h3>Technical Analysis</h3>
        <table class="stats-table">
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Assessment</th>
          </tr>
          <tr>
            <td>Production Quality Index</td>
            <td><strong>${anime.stats.productionQualityIndex}%</strong></td>
            <td>${anime.stats.productionQualityIndex >= 85 ? 'Excellent' : anime.stats.productionQualityIndex >= 70 ? 'Good' : 'Average'}</td>
          </tr>
          <tr>
            <td>Quality Trend</td>
            <td>
              <span class="trend-indicator ${anime.stats.qualityTrend.direction}">
                ${trendIcon} ${anime.stats.qualityTrend.slope > 0 ? '+' : ''}${anime.stats.qualityTrend.slope.toFixed(2)}
              </span>
            </td>
            <td>${anime.stats.qualityTrend.direction.charAt(0).toUpperCase() + anime.stats.qualityTrend.direction.slice(1)}</td>
          </tr>
          <tr>
            <td>Quality Dips</td>
            <td>${anime.stats.qualityDips.length}</td>
            <td style="font-size: 0.75rem;">${dipsText}</td>
          </tr>
          <tr>
            <td>Score Range</td>
            <td>${anime.stats.lowestScore} - ${anime.stats.highestScore}</td>
            <td>Variance: ${anime.stats.stdDev.toFixed(2)}</td>
          </tr>
        </table>

        <div class="retention-analysis">
          <h4>Retention Analysis</h4>
          <div class="retention-metric">
            <span class="label">Controversy Potential:</span>
            <span class="value">${anime.stats.controversyPotential}%</span>
          </div>
          <p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.75rem;">
            ${anime.stats.controversyPotential >= 70 ? 'Highly divisive - generates discussion and debate!' :
              anime.stats.controversyPotential >= 40 ? 'Some controversy - interesting talking points.' :
              'Low controversy - consistent quality perception.'}
          </p>
          ${sharkJump ? `
            <div class="shark-jump-indicator">
              Shark Jump detected at Episode ${sharkJump.episode} (${sharkJump.dropAmount} point drop)
            </div>
          ` : `
            <div class="retention-metric" style="margin-top: 0.75rem;">
              <span class="label">Shark Jump:</span>
              <span class="value" style="color: var(--success);">None detected</span>
            </div>
          `}
        </div>
      </div>
    `;
  },

  /**
   * Close detail modal
   */
  closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (modal) {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    }
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

/**
 * Chart.js configurations for anime scoring dashboard
 */

const Charts = {
  // Color palette for different anime - refined minimalist
  colors: [
    { bg: 'rgba(161, 161, 170, 0.25)', border: 'rgb(161, 161, 170)' },  // Zinc
    { bg: 'rgba(96, 165, 250, 0.25)', border: 'rgb(96, 165, 250)' },    // Blue
    { bg: 'rgba(52, 211, 153, 0.25)', border: 'rgb(52, 211, 153)' },    // Emerald
    { bg: 'rgba(251, 191, 36, 0.25)', border: 'rgb(251, 191, 36)' },    // Amber
    { bg: 'rgba(167, 139, 250, 0.25)', border: 'rgb(167, 139, 250)' },  // Violet
    { bg: 'rgba(244, 114, 182, 0.25)', border: 'rgb(244, 114, 182)' },  // Pink
    { bg: 'rgba(248, 113, 113, 0.25)', border: 'rgb(248, 113, 113)' },  // Red
    { bg: 'rgba(45, 212, 191, 0.25)', border: 'rgb(45, 212, 191)' },    // Teal
  ],

  mainChart: null,
  sortChart: null,
  detailChart: null,

  /**
   * Get color for an anime by index
   * @param {number} index - Index of the anime
   * @returns {Object} Color object with bg and border
   */
  getColor(index) {
    return this.colors[index % this.colors.length];
  },

  /**
   * Get metric configuration for any sort key
   * @param {string} sortKey - Sort metric key
   * @returns {Object} Metric key, label, max value, and whether lower is better
   */
  getMetricConfig(sortKey) {
    const metrics = {
      // Retention metrics
      threeEpisodeHook: { key: 'threeEpisodeHook', label: 'Hook Strength', max: 100, suffix: '%', lowerIsBetter: false },
      churnRisk: { key: 'churnRisk', label: 'Drop Risk', max: 100, suffix: '%', lowerIsBetter: true, isObject: true, valueKey: 'score' },
      habitBreakRisk: { key: 'habitBreakRisk', label: 'Habit Break Risk', max: 10, suffix: ' /10 eps', lowerIsBetter: true },
      momentum: { key: 'momentum', label: 'Momentum', max: 100, suffix: '', lowerIsBetter: false, allowNegative: true },
      narrativeAcceleration: { key: 'narrativeAcceleration', label: 'Story Acceleration', max: 1, suffix: '', lowerIsBetter: false, allowNegative: true },
      flowState: { key: 'flowState', label: 'Flow State', max: 100, suffix: '%', lowerIsBetter: false },
      barrierToEntry: { key: 'barrierToEntry', label: 'Entry Barrier', max: 2, suffix: '', lowerIsBetter: true },
      controversyPotential: { key: 'controversyPotential', label: 'Controversy Score', max: 100, suffix: '%', lowerIsBetter: true },
      sharkJump: { key: 'sharkJump', label: 'Shark Jump', max: 1, suffix: '', lowerIsBetter: false, isObject: true, valueKey: 'episode' },

      // Core engagement metrics
      reliability: { key: 'reliabilityScore', label: 'Consistency Score', max: 100, suffix: '%', lowerIsBetter: false },
      sessionSafety: { key: 'sessionSafety', label: 'Session Safety', max: 100, suffix: '%', lowerIsBetter: false },
      peakEpisodes: { key: 'peakEpisodeCount', label: 'Peak Episodes', max: 10, suffix: '', lowerIsBetter: false },
      finaleStrength: { key: 'finaleStrength', label: 'Finale Strength', max: 100, suffix: '%', lowerIsBetter: false },
      worthFinishing: { key: 'worthFinishing', label: 'Completion Score', max: 100, suffix: '%', lowerIsBetter: false },
      comfort: { key: 'comfortScore', label: 'Relaxation Score', max: 100, suffix: '%', lowerIsBetter: false },
      emotionalStability: { key: 'emotionalStability', label: 'Emotional Stability', max: 100, suffix: '%', lowerIsBetter: false },
      stressSpikes: { key: 'stressSpikes', label: 'Stress Spikes', max: 10, suffix: ' /10 eps', lowerIsBetter: true },
      productionQuality: { key: 'productionQualityIndex', label: 'Quality Score', max: 100, suffix: '%', lowerIsBetter: false },
      improving: { key: 'qualityTrend', label: 'Quality Trend', max: 1, suffix: '', lowerIsBetter: false, isObject: true, valueKey: 'slope' },
      qualityDips: { key: 'qualityDips', label: 'Quality Dips', max: 10, suffix: '', lowerIsBetter: true, isObject: true, valueKey: 'length' },

      // Core metrics
      average: { key: 'average', label: 'Average Score', max: 5, suffix: '', lowerIsBetter: false },
      auc: { key: 'auc', label: 'Overall Score', max: 100, suffix: '%', lowerIsBetter: false },
      consistency: { key: 'stdDev', label: 'Score Spread', max: 2, suffix: '', lowerIsBetter: true },
      retention: { key: 'retentionScore', label: 'Retention Score', max: 100, suffix: '%', lowerIsBetter: false },
      satisfaction: { key: 'malSatisfactionScore', label: 'Satisfaction Score (MAL)', max: 10, suffix: '/10', lowerIsBetter: false }
    };
    return metrics[sortKey] || { key: 'average', label: 'Average Score', max: 5, suffix: '', lowerIsBetter: false };
  },

  /**
   * Get metric configuration for a profile (legacy, for default chart metric)
   * @param {string} profile - Current profile
   * @returns {Object} Metric key, label, and max value
   */
  getMetricForProfile(profile) {
    const metrics = {
      programmer: { key: 'reliabilityScore', label: 'Consistency Score', max: 100, suffix: '%' },
      completionist: { key: 'worthFinishing', label: 'Completion Score', max: 100, suffix: '%' },
      escapist: { key: 'comfortScore', label: 'Relaxation Score', max: 100, suffix: '%' },
      focuser: { key: 'productionQualityIndex', label: 'Quality Score', max: 100, suffix: '%' }
    };
    return metrics[profile] || { key: 'retentionScore', label: 'Retention Score', max: 100, suffix: '%' };
  },

  /**
   * Get human-readable title for any metric
   * @param {string} sortKey - Sort metric key
   * @returns {string} Human-readable title
   */
  getMetricTitle(sortKey) {
    const config = this.getMetricConfig(sortKey);
    return config.label;
  },

  /**
   * Get explanation/description for any metric
   * @param {string} sortKey - Sort metric key
   * @returns {string} Human-readable explanation
   */
  getMetricDescription(sortKey) {
    const descriptions = {
      // Retention metrics
      threeEpisodeHook: 'Measures opening strength - average score of first 3 episodes normalized with a strict curve',
      churnRisk: 'Probability of dropping based on quality slumps, recent dips, and baseline quality penalty',
      habitBreakRisk: 'Longest chain of consecutive episodes below the series median, scaled per 10 episodes',
      momentum: 'Compares last 3 episodes to overall average. Positive = building momentum',
      narrativeAcceleration: 'Story pacing in second half. Positive slope = building to climax',
      flowState: 'Viewing smoothness - higher means fewer jarring quality changes between episodes',
      barrierToEntry: 'Variability of first 5 episodes. Lower = easier to get into',
      controversyPotential: 'Presence of both very high and very low scores indicates discussion-worthy content',
      sharkJump: 'Episode where quality permanently dropped by >0.8 point',

      // Engagement metrics
      reliability: 'Hook Strength (scaled for long series) + Session Safety + Low Drop Risk + Habit Safety',
      sessionSafety: 'Blends safe-episode ratio with overall quality for stricter session safety',
      peakEpisodes: 'Number of episodes with perfect 5/5 score',
      finaleStrength: 'Compares final 25% of episodes to earlier parts. 50% = neutral',
      worthFinishing: 'Finale Strength (50%) + Momentum (30%) + Narrative Acceleration (20%)',
      comfort: 'Flow State (40%) + Emotional Stability (30%) + Entry Ease (20%) + Low Stress Spikes (10%)',
      emotionalStability: 'Smoothness of episode-to-episode score changes',
      stressSpikes: 'Rate of 1.5+ point drops between episodes, per 10 episodes',
      productionQuality: 'Average (35%) + Consistency (15%) + Trend (20%) + Hook (15%) + Low Drop Risk (15%) - dip penalties',
      improving: 'Linear regression slope of all episode scores. Positive = improving',
      qualityDips: 'Episodes scoring more than 0.8 below the series average',

      // Core metrics
      average: 'Mean score across all episodes',
      auc: 'Total score normalized against a perfect run with a strict curve',
      consistency: 'Standard deviation of scores - lower means more consistent',
      retention: 'Retention blend with a lighter opening weight for long series and slow-burn boosts',
      satisfaction: 'Community satisfaction score from MyAnimeList (MAL)'
    };
    return descriptions[sortKey] || '';
  },

  /**
   * Get metric definition/explanation for a profile (legacy)
   * @param {string} profile - Current profile
   * @returns {string} Human-readable explanation of how the metric is calculated
   */
  getMetricDefinition(profile) {
    const definitions = {
      programmer: 'Hook Strength (scaled for long series) + Session Safety + Low Drop Risk + Habit Safety',
      completionist: 'Finale Strength (50%) + Momentum (30%) + Narrative Acceleration (20%)',
      escapist: 'Flow State (40%) + Emotional Stability (30%) + Entry Ease (20%) + Low Stress Spikes (10%)',
      focuser: 'Average (35%) + Consistency (15%) + Trend (20%) + Hook (15%) + Low Drop Risk (15%) - dip penalties'
    };
    return definitions[profile] || 'Opening weight scales down for long series; strong finales soften early penalties';
  },

  /**
   * Extract numeric value for a metric (handles object-based metrics)
   * @param {Object} anime - Anime object with stats
   * @param {Object} metricConfig - Metric configuration
   * @param {Object} context - Optional context (e.g., maxEpisodes)
   * @returns {number} Numeric value for charting
   */
  getMetricValue(anime, metricConfig, context = {}) {
    if (!anime || !anime.stats) return 0;

    if (metricConfig.key === 'sharkJump') {
      if (anime.stats.sharkJump && typeof anime.stats.sharkJump.episode === 'number') {
        return anime.stats.sharkJump.episode;
      }
      const fallbackMax = typeof context.maxEpisodes === 'number'
        ? context.maxEpisodes
        : (Array.isArray(anime.episodes) ? anime.episodes.length : 0);
      return fallbackMax > 0 ? fallbackMax + 1 : 0;
    }

    if (metricConfig.isObject) {
      const value = anime.stats[metricConfig.key];
      if (!value) return 0;
      if (metricConfig.valueKey === 'length') {
        return Array.isArray(value) ? value.length : 0;
      }
      return typeof value === 'object' && metricConfig.valueKey ? (value[metricConfig.valueKey] ?? 0) : 0;
    }

    return anime.stats[metricConfig.key] ?? 0;
  },

  /**
   * Format a metric value for display
   * @param {number} value - Numeric value
   * @param {Object} metricConfig - Metric configuration
   * @param {Object} anime - Anime object with stats
   * @returns {string} Formatted value string
   */
  formatMetricValue(value, metricConfig, anime) {
    if (metricConfig.key === 'sharkJump') {
      return anime?.stats?.sharkJump ? `Ep ${anime.stats.sharkJump.episode}` : 'None';
    }

    const suffix = metricConfig.suffix || '';
    if (suffix === '%') {
      return `${Math.round(value)}${suffix}`;
    }

    const decimals = metricConfig.max && metricConfig.max <= 5 ? 2 : (metricConfig.max && metricConfig.max <= 10 ? 1 : 0);
    const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(decimals);
    return `${rounded}${suffix}`;
  },

  /**
   * Get bar color based on value relative to max
   * @param {number} value - Current value
   * @param {number} maxValue - Maximum possible value
   * @returns {Object} Color object with bg and border
   */
  getBarColorByValue(value, maxValue) {
    const ratio = value / maxValue;
    // Enhanced 7-tier color gradient for better score visibility
    if (ratio >= 0.90) return { bg: 'rgba(16, 185, 129, 0.85)', border: 'rgb(16, 185, 129)' };   // Emerald - exceptional
    if (ratio >= 0.80) return { bg: 'rgba(34, 197, 94, 0.85)', border: 'rgb(34, 197, 94)' };    // Green - excellent
    if (ratio >= 0.70) return { bg: 'rgba(132, 204, 22, 0.85)', border: 'rgb(132, 204, 22)' };  // Lime - very good
    if (ratio >= 0.60) return { bg: 'rgba(234, 179, 8, 0.85)', border: 'rgb(234, 179, 8)' };    // Yellow - good
    if (ratio >= 0.50) return { bg: 'rgba(251, 146, 60, 0.85)', border: 'rgb(251, 146, 60)' };  // Orange - average
    if (ratio >= 0.40) return { bg: 'rgba(249, 115, 22, 0.85)', border: 'rgb(249, 115, 22)' };  // Dark orange - below avg
    return { bg: 'rgba(239, 68, 68, 0.85)', border: 'rgb(239, 68, 68)' };                        // Red - poor
  },

  /**
   * Truncate text to specified length with ellipsis
   * @param {string} text - Text to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated text
   */
  truncateText(text, maxLength = 20) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  },

  /**
   * Create or reuse a custom tooltip element for chart hovers
   * @param {Object} chart - Chart.js instance
   * @returns {HTMLElement|null} Tooltip element
   */
  getOrCreateChartTooltip(chart) {
    const parent = chart?.canvas?.parentNode;
    if (!parent) return null;

    let tooltipEl = parent.querySelector('.chart-tooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'chart-tooltip';
      tooltipEl.innerHTML = `
        <div class="chart-tooltip-card">
          <img class="chart-tooltip-cover" alt="" />
          <div class="chart-tooltip-content">
            <div class="chart-tooltip-title"></div>
            <div class="chart-tooltip-metric"></div>
            <div class="chart-tooltip-sub"></div>
          </div>
        </div>
      `;
      parent.appendChild(tooltipEl);

      const coverEl = tooltipEl.querySelector('.chart-tooltip-cover');
      if (coverEl) {
        coverEl.addEventListener('error', () => {
          if (coverEl.dataset.fallback) return;
          coverEl.dataset.fallback = '1';
          coverEl.src = 'https://via.placeholder.com/60x85?text=No+Image';
        });
      }
    }

    return tooltipEl;
  },

  /**
   * Create the main bar chart for profile metrics
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} animeList - Array of anime with stats
   * @param {string} profile - Current profile
   * @returns {Chart} Chart.js instance
   */
  createMainBarChart(canvasId, animeList, profile) {
    const metricConfig = this.getMetricForProfile(profile);
    return this.createMetricBarChart(canvasId, animeList, metricConfig, 'mainChart');
  },

  /**
   * Create a metric-based bar chart
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} animeList - Array of anime with stats
   * @param {Object} metricConfig - Metric config for chart
   * @param {string} chartKey - Chart instance key
   * @returns {Chart} Chart.js instance
   */
  createMetricBarChart(canvasId, animeList, metricConfig, chartKey = 'mainChart') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Register datalabels plugin if available
    if (typeof ChartDataLabels !== 'undefined') {
      Chart.register(ChartDataLabels);
    }

    // Destroy existing chart if any
    if (this[chartKey]) {
      this[chartKey].destroy();
    }

    const chartAnime = [...animeList];

    // Prepare data
    const labels = chartAnime.map(a => this.truncateText(a.title, 18));
    const maxEpisodes = chartAnime.reduce((max, anime) => {
      const count = Array.isArray(anime.episodes) ? anime.episodes.length : 0;
      return Math.max(max, count);
    }, 0);
    const values = chartAnime.map(a => this.getMetricValue(a, metricConfig, { maxEpisodes }));
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxAbs = metricConfig.allowNegative
      ? Math.max(Math.abs(maxValue), Math.abs(minValue), metricConfig.max || 0)
      : 0;
    const axisMax = metricConfig.allowNegative
      ? maxAbs
      : Math.max(metricConfig.max || 0, maxValue);
    const axisMin = metricConfig.allowNegative ? -maxAbs : 0;
    const colorMax = axisMax || 1;
    const bgColors = values.map(v => {
      if (metricConfig.allowNegative && axisMax > 0) {
        const shifted = ((v + axisMax) / (2 * axisMax)) * axisMax;
        return this.getBarColorByValue(shifted, colorMax).bg;
      }
      const adjusted = metricConfig.lowerIsBetter ? (axisMax - v) : v;
      return this.getBarColorByValue(adjusted, colorMax).bg;
    });
    const borderColors = values.map(v => {
      if (metricConfig.allowNegative && axisMax > 0) {
        const shifted = ((v + axisMax) / (2 * axisMax)) * axisMax;
        return this.getBarColorByValue(shifted, colorMax).border;
      }
      const adjusted = metricConfig.lowerIsBetter ? (axisMax - v) : v;
      return this.getBarColorByValue(adjusted, colorMax).border;
    });

    const displayThreshold = axisMax >= 100 ? 20 : Math.max(axisMax * 0.2, 0.5);

    this[chartKey] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: metricConfig.label,
          data: values,
          backgroundColor: bgColors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'center',
            align: 'center',
            color: '#ffffff',
            font: { weight: 'bold', size: 11 },
            formatter: (value, context) => this.formatMetricValue(value, metricConfig, chartAnime[context.dataIndex]),
            display: (context) => Math.abs(context.dataset.data[context.dataIndex]) >= displayThreshold
          },
          tooltip: {
            enabled: false,
            external: (context) => {
              const { chart, tooltip } = context;
              const tooltipEl = this.getOrCreateChartTooltip(chart);
              if (!tooltipEl) return;

              if (tooltip.opacity === 0) {
                tooltipEl.style.opacity = 0;
                return;
              }

              const point = tooltip.dataPoints?.[0];
              if (!point) {
                tooltipEl.style.opacity = 0;
                return;
              }

              const index = point.dataIndex;
              const anime = chartAnime[index];
              const titleEl = tooltipEl.querySelector('.chart-tooltip-title');
              const metricEl = tooltipEl.querySelector('.chart-tooltip-metric');
              const subEl = tooltipEl.querySelector('.chart-tooltip-sub');
              const coverEl = tooltipEl.querySelector('.chart-tooltip-cover');

              const coverSrc = anime?.cover || anime?.metadata?.cover || '';
              if (coverEl) {
                if (coverSrc) {
                  coverEl.src = coverSrc;
                  coverEl.style.display = '';
                  delete coverEl.dataset.fallback;
                } else {
                  coverEl.style.display = 'none';
                }
              }

              if (titleEl) {
                titleEl.textContent = anime?.title || '';
              }
              if (metricEl) {
                metricEl.textContent = `${metricConfig.label}: ${this.formatMetricValue(point.raw, metricConfig, anime)}`;
              }
              if (subEl) {
                if (anime?.stats && typeof anime.stats.average === 'number') {
                  subEl.textContent = `Avg Score: ${anime.stats.average.toFixed(2)}/5`;
                  subEl.style.display = 'block';
                } else {
                  subEl.textContent = '';
                  subEl.style.display = 'none';
                }
              }

              const canvasRect = chart.canvas.getBoundingClientRect();
              const parentRect = chart.canvas.parentNode.getBoundingClientRect();
              const tooltipWidth = tooltipEl.offsetWidth;
              const tooltipHeight = tooltipEl.offsetHeight;
              const padding = 8;
              const rawX = canvasRect.left - parentRect.left + tooltip.caretX;
              const rawY = canvasRect.top - parentRect.top + tooltip.caretY;
              const offsetX = 14;
              const offsetY = 14;

              let x = rawX + offsetX;
              if (x + tooltipWidth + padding > parentRect.width) {
                x = rawX - tooltipWidth - offsetX;
              }
              x = Math.max(padding, Math.min(x, parentRect.width - tooltipWidth - padding));

              let y = rawY - tooltipHeight - offsetY;
              let placeBelow = false;
              if (y < padding) {
                y = rawY + offsetY;
                placeBelow = true;
              }
              if (y + tooltipHeight + padding > parentRect.height) {
                y = parentRect.height - tooltipHeight - padding;
              }

              tooltipEl.classList.toggle('below', placeBelow);
              tooltipEl.style.left = `${x}px`;
              tooltipEl.style.top = `${y}px`;
              tooltipEl.style.opacity = 1;
            }
          }
        },
        scales: {
          y: {
            min: axisMin,
            max: axisMax,
            ticks: {
              stepSize: axisMax <= 2 ? 0.5 : (axisMax <= 5 ? 1 : (axisMax <= 10 ? 2 : 20)),
              font: { size: 12 },
              callback: function(value) {
                return metricConfig.suffix === '%' ? value + '%' : value;
              }
            },
            grid: {
              color: 'rgba(39, 39, 42, 0.8)'
            },
            title: {
              display: true,
              text: metricConfig.label,
              font: { size: 13, weight: '500' }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 45
            }
          }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            const anime = chartAnime[index];
            if (anime && typeof App !== 'undefined' && App.showAnimeDetail) {
              App.showAnimeDetail(anime.id);
            }
          }
        }
      }
    });

    return this[chartKey];
  },

  /**
   * Update the main bar chart with new data
   * @param {Array} animeList - Array of anime to display
   * @param {string} profile - Current profile
   */
  updateMainBarChart(animeList, profile) {
    if (!this.mainChart) return;

    const metricConfig = this.getMetricForProfile(profile);

    // Sort anime by the profile metric (descending)
    const sortedAnime = [...animeList].sort((a, b) => {
      const aVal = a.stats?.[metricConfig.key] ?? 0;
      const bVal = b.stats?.[metricConfig.key] ?? 0;
      return bVal - aVal;
    });

    // Prepare data
    const labels = sortedAnime.map(a => this.truncateText(a.title, 18));
    const values = sortedAnime.map(a => a.stats?.[metricConfig.key] ?? 0);
    const bgColors = values.map(v => this.getBarColorByValue(v, metricConfig.max).bg);
    const borderColors = values.map(v => this.getBarColorByValue(v, metricConfig.max).border);

    // Store anime data for tooltip access
    this._barChartAnime = sortedAnime;

    // Update chart
    this.mainChart.data.labels = labels;
    this.mainChart.data.datasets[0].data = values;
    this.mainChart.data.datasets[0].backgroundColor = bgColors;
    this.mainChart.data.datasets[0].borderColor = borderColors;
    this.mainChart.data.datasets[0].label = metricConfig.label;

    // Update y-axis
    this.mainChart.options.scales.y.max = metricConfig.max;
    this.mainChart.options.scales.y.ticks.stepSize = metricConfig.max === 5 ? 1 : 20;
    this.mainChart.options.scales.y.title.text = metricConfig.label;

    this.mainChart.update();
  },

  /**
   * Create the main AUC comparison chart
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} animeList - Array of anime with episodes
   * @returns {Chart} Chart.js instance
   */
  createMainChart(canvasId, animeList) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Destroy existing chart if any
    if (this.mainChart) {
      this.mainChart.destroy();
    }

    // Find the maximum number of episodes
    const maxEpisodes = Math.max(...animeList.map(a => a.episodes.length));
    const labels = Array.from({ length: maxEpisodes }, (_, i) => `Ep ${i + 1}`);

    // Create datasets for each anime
    const datasets = animeList.map((anime, index) => {
      const color = this.getColor(index);
      const scores = anime.episodes.map(ep => ep.score);

      return {
        label: anime.title,
        data: scores,
        fill: true,
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      };
    });

    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12,
                weight: '500'
              }
            }
          },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.95)',
            titleFont: { size: 14, weight: '600' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.raw}/5`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              font: { size: 12 }
            },
            grid: {
              color: 'rgba(39, 39, 42, 0.8)'
            },
            title: {
              display: true,
              text: 'Score',
              font: { size: 13, weight: '500' }
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 11 }
            },
            title: {
              display: true,
              text: 'Episode',
              font: { size: 13, weight: '500' }
            }
          }
        }
      }
    });

    return this.mainChart;
  },

  /**
   * Update main chart to show only selected anime
   * @param {Array} animeList - Array of anime to display
   */
  updateMainChart(animeList) {
    if (!this.mainChart) return;

    const maxEpisodes = Math.max(...animeList.map(a => a.episodes.length));
    const labels = Array.from({ length: maxEpisodes }, (_, i) => `Ep ${i + 1}`);

    const datasets = animeList.map((anime, index) => {
      const color = this.getColor(anime.colorIndex || index);
      const scores = anime.episodes.map(ep => ep.score);

      return {
        label: anime.title,
        data: scores,
        fill: true,
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      };
    });

    this.mainChart.data.labels = labels;
    this.mainChart.data.datasets = datasets;
    this.mainChart.update();
  },

  /**
   * Create a mini sparkline chart for anime cards
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} episodes - Array of episode objects
   * @param {string} color - Color for the line
   * @returns {Chart} Chart.js instance
   */
  createSparkline(canvasId, episodes, colorIndex = 0) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const color = this.getColor(colorIndex);
    const scores = episodes.map(ep => ep.score);

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: episodes.map((_, i) => i + 1),
        datasets: [{
          data: scores,
          fill: true,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: { display: false }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            display: false
          },
          x: {
            display: false
          }
        }
      }
    });
  },

  // Store card area charts for cleanup
  cardAreaCharts: {},

  /**
   * Create an area chart for anime card episode scores
   * @param {string} canvasId - ID of the canvas element
   * @param {Array} episodes - Array of episode objects
   * @param {number} colorIndex - Color index
   * @returns {Chart} Chart.js instance
   */
  createCardAreaChart(canvasId, episodes, colorIndex = 0) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Destroy existing chart if any
    if (this.cardAreaCharts[canvasId]) {
      this.cardAreaCharts[canvasId].destroy();
      delete this.cardAreaCharts[canvasId];
    }

    const color = this.getColor(colorIndex);
    const scores = episodes.map(ep => ep.score);
    const labels = episodes.map(ep => `Ep ${ep.episode}`);

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: scores,
          fill: true,
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: color.border,
          pointBorderColor: '#fff',
          pointBorderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.95)',
            titleFont: { size: 12, weight: '600' },
            bodyFont: { size: 11 },
            padding: 8,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return `Score: ${context.raw}/5`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              font: { size: 9 },
              callback: function(value) {
                return value;
              }
            },
            grid: {
              color: 'rgba(39, 39, 42, 0.6)'
            }
          },
          x: {
            display: true,
            ticks: {
              font: { size: 8 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6
            },
            grid: {
              display: false
            }
          }
        }
      }
    });

    this.cardAreaCharts[canvasId] = chart;
    return chart;
  },

  /**
   * Destroy all card area charts
   */
  destroyAllCardAreaCharts() {
    Object.values(this.cardAreaCharts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.cardAreaCharts = {};
  },

  /**
   * Get profile-specific chart options
   * @param {string} profile - Current profile
   * @returns {Object} Chart options modifications
   */
  getProfileChartOptions(profile) {
    const options = {
      programmer: {
        tension: 0.2,
        pointRadius: 4,
        // Add threshold line annotation for "bad episode" at score 3
        plugins: {
          annotation: {
            annotations: {
              badLine: {
                type: 'line',
                yMin: 3,
                yMax: 3,
                borderColor: 'rgba(239, 68, 68, 0.5)',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'Risk Threshold',
                  position: 'start',
                  backgroundColor: 'rgba(239, 68, 68, 0.8)',
                  font: { size: 10 }
                }
              }
            }
          }
        }
      },
      completionist: {
        tension: 0.3,
        pointRadius: 5,
        // Highlight peak episodes with larger points
        pointStyle: 'circle'
      },
      escapist: {
        tension: 0.5,  // Smoother lines for calmer visual
        pointRadius: 0, // Hide individual points for less visual noise
        fill: true
      },
      focuser: {
        tension: 0.2,
        pointRadius: 4,
        // Show data points clearly for analysis
        pointStyle: 'circle'
      }
    };

    return options[profile] || { tension: 0.3, pointRadius: 4 };
  },

  /**
   * Update main chart with profile-specific styling
   * @param {Array} animeList - Array of anime to display
   * @param {string} profile - Current profile
   */
  updateMainChartForProfile(animeList, profile) {
    if (!this.mainChart) return;

    const profileOptions = this.getProfileChartOptions(profile);
    const maxEpisodes = Math.max(...animeList.map(a => a.episodes.length));
    const labels = Array.from({ length: maxEpisodes }, (_, i) => `Ep ${i + 1}`);

    const datasets = animeList.map((anime, index) => {
      const color = this.getColor(anime.colorIndex || index);
      const scores = anime.episodes.map(ep => ep.score);

      // Base dataset options
      const dataset = {
        label: anime.title,
        data: scores,
        fill: profileOptions.fill !== false,
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 2,
        tension: profileOptions.tension,
        pointRadius: profileOptions.pointRadius,
        pointHoverRadius: 6,
        pointBackgroundColor: color.border,
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      };

      // Profile-specific modifications
      if (profile === 'completionist') {
        // Highlight peak episodes with different point sizes
        dataset.pointRadius = scores.map(s => s === 5 ? 8 : 4);
        dataset.pointBackgroundColor = scores.map(s =>
          s === 5 ? 'rgb(245, 158, 11)' : color.border
        );
      }

      return dataset;
    });

    this.mainChart.data.labels = labels;
    this.mainChart.data.datasets = datasets;
    this.mainChart.update();
  },

  /**
   * Create a trend line chart for Focuser profile
   * @param {string} canvasId - ID of the canvas element
   * @param {Object} anime - Anime object with episodes and stats
   * @returns {Chart} Chart.js instance
   */
  createTrendChart(canvasId, anime) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const episodes = anime.episodes;
    const scores = episodes.map(ep => ep.score);
    const labels = episodes.map(ep => `Ep ${ep.episode}`);

    // Calculate trend line points
    const n = episodes.length;
    const sumX = episodes.reduce((acc, _, i) => acc + i, 0);
    const sumY = scores.reduce((acc, s) => acc + s, 0);
    const sumXY = scores.reduce((acc, s, i) => acc + (i * s), 0);
    const sumX2 = episodes.reduce((acc, _, i) => acc + (i * i), 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const trendData = episodes.map((_, i) => {
      const trend = intercept + slope * i;
      return Math.max(0, Math.min(5, trend));
    });

    // Calculate rolling average if we have stats
    const rollingData = anime.stats?.rollingAverage?.map(r => r.rollingAvg) || [];
    const rollingLabels = anime.stats?.rollingAverage?.map(r => `Ep ${r.episode}`) || [];

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Episode Score',
            data: scores,
            fill: false,
            backgroundColor: 'rgba(139, 92, 246, 0.3)',
            borderColor: 'rgb(139, 92, 246)',
            borderWidth: 2,
            tension: 0.2,
            pointRadius: 4
          },
          {
            label: 'Trend Line',
            data: trendData,
            fill: false,
            borderColor: slope > 0 ? 'rgb(34, 197, 94)' : slope < 0 ? 'rgb(239, 68, 68)' : 'rgb(148, 163, 184)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              font: { size: 11 }
            }
          },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.95)',
            padding: 12,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: { stepSize: 1 },
            grid: { color: 'rgba(39, 39, 42, 0.8)' }
          },
          x: {
            grid: { display: false }
          }
        }
      }
    });
  },

  /**
   * Create detail bar chart for single anime view
   * @param {string} canvasId - ID of the canvas element
   * @param {Object} anime - Anime object with episodes
   * @param {number} colorIndex - Color index
   * @returns {Chart} Chart.js instance
   */
  createDetailChart(canvasId, anime, colorIndex = 0) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (this.detailChart) {
      this.detailChart.destroy();
    }

    const scores = anime.episodes.map(ep => ep.score);
    const labels = anime.episodes.map(ep => `Episode ${ep.episode}`);

    this.detailChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Score',
          data: scores,
          backgroundColor: scores.map(s => {
            if (s >= 4.5) return 'rgba(34, 197, 94, 0.7)';
            if (s >= 3.5) return 'rgba(99, 102, 241, 0.7)';
            if (s >= 2.5) return 'rgba(234, 179, 8, 0.7)';
            return 'rgba(239, 68, 68, 0.7)';
          }),
          borderColor: scores.map(s => {
            if (s >= 4.5) return 'rgb(34, 197, 94)';
            if (s >= 3.5) return 'rgb(99, 102, 241)';
            if (s >= 2.5) return 'rgb(234, 179, 8)';
            return 'rgb(239, 68, 68)';
          }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'end',
            offset: -4,
            color: '#e5e7eb',
            font: { weight: 'bold', size: 12 },
            formatter: (value) => value.toFixed(1),
            textStrokeColor: 'rgba(0, 0, 0, 0.5)',
            textStrokeWidth: 2
          },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 27, 0.95)',
            titleFont: { size: 14, weight: '600' },
            bodyFont: { size: 13 },
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return `Score: ${context.raw}/5`;
              }
            }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              font: { size: 12 }
            },
            grid: {
              color: 'rgba(39, 39, 42, 0.8)'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: { size: 11 }
            }
          }
        }
      }
    });

    return this.detailChart;
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Charts;
}

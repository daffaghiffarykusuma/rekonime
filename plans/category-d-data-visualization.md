# Category D: Data Visualization & Metrics - Implementation Plan

## Overview
This plan addresses 6 data visualization gaps identified in the Gap Analysis. The goal is to transform Rekonime from an app that "tells" users scores to one that "shows" the story behind them through rich visualizations.

**Design Thinking Insight:** Rich statistical data is calculated but poorly visualized. The app tells users scores but doesn't show the story behind them.

---

## Executive Summary

### Current State
- **Rich data exists:** [`stats.js`](js/stats.js) calculates 40+ metrics per anime (retention, momentum, rolling averages, quality trends, churn risk, etc.)
- **Charts module unused:** [`js/charts.js`](js/charts.js) exists with full Chart.js integration but is **NOT wired in HTML**
- **Poor visualization:** Detail modal shows only 3 simple progress bars for "Why it sticks"
- **Missed opportunities:** Score distributions, episode trends, and comparisons are calculated but never shown

### Target State
- Episode-by-episode score visualizations with trend lines
- Retention breakdown showing exactly where viewers drop off
- Score distribution bell curves with percentile markers
- Side-by-side anime comparison tool
- Weekly timeline view for seasonal watching

---

## Gap D1: Episode Score Graphs

### Problem
Trend data exists via [`calculateRollingAverage()`](js/stats.js:690) but episode scores are not visualized. Users cannot see score trajectory across episodes.

### Evidence
- [`stats.js:690-702`](js/stats.js:690): `calculateRollingAverage()` computes 3-episode rolling averages
- [`js/charts.js:1056-1143`](js/charts.js:1056): `createDetailChart()` creates bar charts but is never called
- Detail modal only shows aggregated scores, no episode breakdown

### Solution
Add interactive episode score charts to detail modal using existing Chart.js infrastructure.

### Technical Specifications

#### HTML Changes (index.html)
```html
<!-- Add Chart.js CDN before app scripts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>

<!-- Add to detail modal content template -->
<div class="detail-charts-section" id="detail-charts-section">
  <div class="detail-section-header">
    <h3>Episode Journey</h3>
    <span class="detail-section-note">Score trajectory across episodes</span>
  </div>
  <div class="chart-tabs">
    <button class="chart-tab active" data-chart="scores">Episode Scores</button>
    <button class="chart-tab" data-chart="rolling">Trend (3-ep avg)</button>
    <button class="chart-tab" data-chart="distribution">Distribution</button>
  </div>
  <div class="chart-container">
    <canvas id="episode-chart"></canvas>
  </div>
  <div class="chart-insights" id="chart-insights">
    <!-- Dynamic insights based on data -->
  </div>
</div>
```

#### JavaScript Integration (js/app.js)
```javascript
/**
 * Render episode charts section in detail modal
 */
renderEpisodeCharts(anime) {
  if (!anime?.episodes?.length) return '';
  
  return `
    <div class="detail-charts-section" id="detail-charts-section">
      <div class="detail-section-header">
        <h3>Episode Journey</h3>
        <span class="detail-section-note">Score trajectory across episodes</span>
      </div>
      <div class="chart-tabs">
        <button class="chart-tab active" data-chart="scores" data-action="switch-chart">Episode Scores</button>
        <button class="chart-tab" data-chart="rolling" data-action="switch-chart">Trend (3-ep avg)</button>
        <button class="chart-tab" data-chart="distribution" data-action="switch-chart">Distribution</button>
      </div>
      <div class="chart-container">
        <canvas id="episode-chart"></canvas>
      </div>
      <div class="chart-insights" id="chart-insights"></div>
    </div>
  `;
},

/**
 * Initialize episode charts after modal is shown
 */
initEpisodeCharts(anime) {
  if (!anime?.episodes?.length || typeof Charts === 'undefined') return;
  
  // Store current anime for chart switching
  this._chartAnime = anime;
  
  // Default to scores view
  this.renderEpisodeScoreChart(anime);
  this.generateChartInsights(anime);
},

/**
 * Render episode score bar chart
 */
renderEpisodeScoreChart(anime) {
  const ctx = document.getElementById('episode-chart');
  if (!ctx) return;
  
  // Use existing Charts module
  if (Charts.detailChart) {
    Charts.detailChart.destroy();
  }
  
  const scores = anime.episodes.map(ep => ep.score);
  const labels = anime.episodes.map(ep => `Ep ${ep.episode}`);
  
  Charts.detailChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Episode Score',
        data: scores,
        backgroundColor: scores.map(s => {
          if (s >= 4.5) return 'rgba(34, 197, 94, 0.8)';  // Green
          if (s >= 3.5) return 'rgba(99, 102, 241, 0.8)'; // Indigo
          if (s >= 2.5) return 'rgba(234, 179, 8, 0.8)';  // Yellow
          return 'rgba(239, 68, 68, 0.8)';                // Red
        }),
        borderColor: scores.map(s => {
          if (s >= 4.5) return 'rgb(34, 197, 94)';
          if (s >= 3.5) return 'rgb(99, 102, 241)';
          if (s >= 2.5) return 'rgb(234, 179, 8)';
          return 'rgb(239, 68, 68)';
        }),
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Score: ${ctx.raw}/5`
          }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(39, 39, 42, 0.5)' }
        },
        x: {
          grid: { display: false },
          ticks: {
            maxTicksLimit: 12,
            callback: (val, idx) => {
              // Show every Nth label based on episode count
              const total = scores.length;
              const step = total > 24 ? Math.ceil(total / 12) : 1;
              return idx % step === 0 ? labels[idx] : '';
            }
          }
        }
      }
    }
  });
},

/**
 * Render rolling average line chart
 */
renderRollingAverageChart(anime) {
  const ctx = document.getElementById('episode-chart');
  if (!ctx || !anime.stats?.rollingAverage) return;
  
  if (Charts.detailChart) {
    Charts.detailChart.destroy();
  }
  
  const rollingData = anime.stats.rollingAverage;
  const labels = rollingData.map(r => `Ep ${r.episode}`);
  const values = rollingData.map(r => r.rollingAvg);
  
  // Calculate trend line
  const trend = this.calculateTrendLine(values);
  
  Charts.detailChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '3-Episode Rolling Average',
          data: values,
          fill: true,
          backgroundColor: 'rgba(139, 92, 246, 0.2)',
          borderColor: 'rgb(139, 92, 246)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 6
        },
        {
          label: 'Trend',
          data: trend,
          borderColor: trend[trend.length - 1] > trend[0] ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
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
          labels: { usePointStyle: true }
        }
      },
      scales: {
        y: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(39, 39, 42, 0.5)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
},

/**
 * Render score distribution histogram
 */
renderScoreDistributionChart(anime) {
  const ctx = document.getElementById('episode-chart');
  if (!ctx) return;
  
  if (Charts.detailChart) {
    Charts.detailChart.destroy();
  }
  
  const scores = anime.episodes.map(ep => ep.score);
  const distribution = this.calculateScoreDistribution(scores);
  
  Charts.detailChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['1.0-1.9', '2.0-2.9', '3.0-3.9', '4.0-4.4', '4.5-5.0'],
      datasets: [{
        label: 'Episode Count',
        data: [
          distribution.poor,
          distribution.belowAvg,
          distribution.average,
          distribution.good,
          distribution.excellent
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(99, 102, 241, 0.8)',
          'rgba(34, 197, 94, 0.8)'
        ],
        borderWidth: 0,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => {
              const total = scores.length;
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return `${pct}% of episodes`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(39, 39, 42, 0.5)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
```

#### CSS Additions (css/styles.css)
```css
/* Episode Charts Section */
.detail-charts-section {
  margin: var(--space-lg) 0;
  padding: var(--space-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.chart-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--space-sm);
}

.chart-tab {
  padding: var(--space-xs) var(--space-md);
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s ease;
}

.chart-tab:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.chart-tab.active {
  background: var(--accent-primary);
  color: var(--text-inverse);
}

.chart-container {
  height: 280px;
  position: relative;
}

.chart-insights {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.chart-insight-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
}

.chart-insight-item:last-child {
  margin-bottom: 0;
}

.chart-insight-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
}

.chart-insight-icon.positive {
  background: rgba(34, 197, 94, 0.2);
  color: rgb(34, 197, 94);
}

.chart-insight-icon.negative {
  background: rgba(239, 68, 68, 0.2);
  color: rgb(239, 68, 68);
}

.chart-insight-icon.neutral {
  background: rgba(99, 102, 241, 0.2);
  color: rgb(99, 102, 241);
}
```

---

## Gap D2: Retention Score Breakdown

### Problem
Retention score is a single abstract number (0-100). The "Why it sticks" section shows 3 bars (start/stay/finish) but doesn't show WHERE in the episode journey viewers might drop off.

### Evidence
- [`app.js:3470-3515`](js/app.js:3470): Simple progress bars for start/stay/finish
- [`stats.js:868-895`](js/stats.js:868): Retention calculated from hook, churn risk, momentum, flow
- [`stats.js:789-855`](js/stats.js:789): Churn risk factors include "quality slump" episode counts

### Solution
Add episode map visualization showing risk zones and highlight episodes where viewers are likely to drop off.

### Technical Specifications

#### HTML Template (js/app.js)
```javascript
/**
 * Render retention episode map
 */
renderRetentionEpisodeMap(anime) {
  if (!anime?.episodes?.length) return '';
  
  const episodes = anime.episodes;
  const stats = anime.stats;
  const churnRisk = stats?.churnRisk;
  
  // Identify risk episodes
  const riskEpisodes = this.identifyRiskEpisodes(episodes, stats);
  const peakEpisodes = this.identifyPeakEpisodes(episodes);
  
  return `
    <div class="retention-map-section" id="retention-map-section">
      <div class="detail-section-header">
        <h3>Retention Journey Map</h3>
        <span class="detail-section-note">Episode-by-episode engagement</span>
      </div>
      
      <div class="retention-legend">
        <div class="legend-item">
          <span class="legend-dot excellent"></span>
          <span>Peak (5/5)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot good"></span>
          <span>Strong (4/5)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot average"></span>
          <span>Average (3/5)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot risk"></span>
          <span>Drop-off Risk</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot weak"></span>
          <span>Weak (<3)</span>
        </div>
      </div>
      
      <div class="episode-map">
        ${episodes.map((ep, idx) => {
          const isRisk = riskEpisodes.includes(ep.episode);
          const isPeak = peakEpisodes.includes(ep.episode);
          const scoreClass = this.getScoreClass(ep.score);
          const tooltip = this.getEpisodeTooltip(ep, idx + 1, episodes.length, stats);
          
          return `
            <div class="episode-node ${scoreClass} ${isRisk ? 'risk' : ''} ${isPeak ? 'peak' : ''}"
                 style="--episode-index: ${idx}"
                 data-episode="${ep.episode}"
                 data-score="${ep.score}">
              <div class="episode-tooltip">${tooltip}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div class="retention-milestones">
        ${this.renderRetentionMilestones(episodes, stats)}
      </div>
    </div>
  `;
},

/**
 * Identify episodes with drop-off risk
 */
identifyRiskEpisodes(episodes, stats) {
  const risks = [];
  const avg = stats?.average || 0;
  const threshold = avg - 0.8; // Quality dip threshold
  
  episodes.forEach((ep, idx) => {
    // Episode below threshold
    if (ep.score < threshold) {
      risks.push(ep.episode);
      return;
    }
    
    // Consecutive weak episodes
    if (idx > 0 && idx < episodes.length - 1) {
      const prev = episodes[idx - 1].score;
      const next = episodes[idx + 1]?.score;
      if (ep.score < 3 && prev < 3) {
        risks.push(ep.episode);
      }
    }
    
    // Sharp drop from previous
    if (idx > 0) {
      const prev = episodes[idx - 1].score;
      if (prev - ep.score >= 1.5) {
        risks.push(ep.episode);
      }
    }
  });
  
  return risks;
}
```

#### CSS for Retention Map
```css
/* Retention Episode Map */
.retention-map-section {
  margin: var(--space-lg) 0;
  padding: var(--space-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
}

.retention-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.excellent { background: rgb(34, 197, 94); }
.legend-dot.good { background: rgb(99, 102, 241); }
.legend-dot.average { background: rgb(234, 179, 8); }
.legend-dot.risk { background: rgb(239, 68, 68); box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3); }
.legend-dot.weak { background: rgb(156, 163, 175); }

.episode-map {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: var(--space-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  min-height: 60px;
  align-content: flex-start;
}

.episode-node {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  position: relative;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.episode-node:hover {
  transform: scale(1.2);
  z-index: 10;
}

.episode-node.excellent { background: rgba(34, 197, 94, 0.8); }
.episode-node.good { background: rgba(99, 102, 241, 0.8); }
.episode-node.average { background: rgba(234, 179, 8, 0.8); }
.episode-node.weak { background: rgba(156, 163, 175, 0.5); }

.episode-node.risk {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.6);
  animation: pulse-risk 2s ease-in-out infinite;
}

.episode-node.peak {
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.6);
}

@keyframes pulse-risk {
  0%, 100% { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.6); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3); }
}

.episode-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(-8px);
  padding: var(--space-xs) var(--space-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 100;
  box-shadow: var(--shadow-lg);
}

.episode-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--bg-tertiary);
}

.episode-node:hover .episode-tooltip {
  opacity: 1;
}
```

---

## Gap D3: Comparative Views

### Problem
Modal shows single anime only. Users cannot compare 2+ anime side-by-side to make decisions.

### Solution
Add comparison mode allowing users to select and compare up to 3 anime with metric tables and overlaid charts.

### Technical Specifications

#### New Module: js/comparison.js
```javascript
const Comparison = {
  maxComparisons: 3,
  selectedAnime: [],
  
  /**
   * Add anime to comparison
   */
  add(animeId) {
    if (this.selectedAnime.length >= this.maxComparisons) {
      return { success: false, error: 'Maximum 3 anime can be compared' };
    }
    if (this.selectedAnime.includes(animeId)) {
      return { success: false, error: 'Already in comparison' };
    }
    this.selectedAnime.push(animeId);
    this.saveState();
    return { success: true };
  },
  
  /**
   * Remove anime from comparison
   */
  remove(animeId) {
    this.selectedAnime = this.selectedAnime.filter(id => id !== animeId);
    this.saveState();
  },
  
  /**
   * Clear all comparisons
   */
  clear() {
    this.selectedAnime = [];
    this.saveState();
  },
  
  /**
   * Get comparison data
   */
  getComparisonData(animeList) {
    return this.selectedAnime
      .map(id => animeList.find(a => a.id === id))
      .filter(Boolean);
  },
  
  /**
   * Save state to localStorage
   */
  saveState() {
    localStorage.setItem('rekonime.comparison', JSON.stringify(this.selectedAnime));
  },
  
  /**
   * Load state from localStorage
   */
  loadState() {
    try {
      this.selectedAnime = JSON.parse(localStorage.getItem('rekonime.comparison') || '[]');
    } catch {
      this.selectedAnime = [];
    }
  }
};

window.Comparison = Comparison;
```

#### Comparison Modal Template
```javascript
/**
 * Render comparison modal content
 */
renderComparisonModal(animeList) {
  const anime = Comparison.getComparisonData(animeList);
  if (anime.length === 0) {
    return `
      <div class="comparison-empty">
        <p>No anime selected for comparison.</p>
        <p>Click the compare button on anime cards to add them.</p>
      </div>
    `;
  }
  
  return `
    <div class="comparison-container">
      <div class="comparison-header">
        <h2>Compare Anime</h2>
        <button class="btn btn-sm" data-action="clear-comparison">Clear All</button>
      </div>
      
      <div class="comparison-table-wrapper">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              ${anime.map(a => `
                <th>
                  <div class="comparison-anime-header">
                    <img src="${a.cover}" alt="" class="comparison-thumb">
                    <span>${a.title}</span>
                    <button class="comparison-remove" data-action="remove-comparison" data-anime-id="${a.id}">×</button>
                  </div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${this.renderComparisonRows(anime)}
          </tbody>
        </table>
      </div>
      
      <div class="comparison-chart-section">
        <h3>Episode Scores Comparison</h3>
        <div class="chart-container" style="height: 300px;">
          <canvas id="comparison-chart"></canvas>
        </div>
      </div>
    </div>
  `;
},

/**
 * Render comparison table rows
 */
renderComparisonRows(anime) {
  const metrics = [
    { key: 'stats.average', label: 'Average Score', format: v => v?.toFixed(2) },
    { key: 'stats.retentionScore', label: 'Retention Score', format: v => v ? `${Math.round(v)}%` : 'N/A' },
    { key: 'communityScore', label: 'MAL Score', format: v => v ? `${v.toFixed(1)}/10` : 'N/A' },
    { key: 'stats.episodeCount', label: 'Episodes', format: v => v || 'N/A' },
    { key: 'stats.threeEpisodeHook', label: 'Hook Strength', format: v => v ? `${Math.round(v)}%` : 'N/A' },
    { key: 'stats.worthFinishing', label: 'Finale Payoff', format: v => v ? `${Math.round(v)}%` : 'N/A' },
    { key: 'stats.flowState', label: 'Flow State', format: v => v ? `${Math.round(v)}%` : 'N/A' },
    { key: 'year', label: 'Year', format: v => v || 'N/A' },
    { key: 'studio', label: 'Studio', format: v => Array.isArray(v) ? v.join(', ') : v || 'N/A' }
  ];
  
  return metrics.map(metric => `
    <tr>
      <td class="metric-label">${metric.label}</td>
      ${anime.map(a => {
        const value = metric.key.split('.').reduce((obj, key) => obj?.[key], a);
        const formatted = metric.format(value);
        const best = this.isBestValue(metric.key, value, anime);
        return `<td class="${best ? 'best-value' : ''}">${formatted}</td>`;
      }).join('')}
    </tr>
  `).join('');
}
```

#### CSS for Comparison
```css
/* Comparison Modal */
.comparison-modal .modal-content {
  max-width: 1000px;
  width: 95%;
}

.comparison-container {
  padding: var(--space-lg);
}

.comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.comparison-table-wrapper {
  overflow-x: auto;
  margin-bottom: var(--space-xl);
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.comparison-table th,
.comparison-table td {
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.comparison-table th {
  background: var(--bg-secondary);
  font-weight: 600;
  min-width: 150px;
}

.comparison-anime-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  position: relative;
}

.comparison-thumb {
  width: 40px;
  height: 56px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.comparison-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--danger-color);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.comparison-table .metric-label {
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.comparison-table .best-value {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
  font-weight: 600;
}
```

---

## Gap D4: Score Distribution Visualization

### Problem
Score profile is calculated (p35, p50, p65 percentiles) but not shown to users. No bell curve or percentile context.

### Solution
Add score distribution visualization showing where an anime falls in the overall catalog distribution.

### Technical Specifications
```javascript
/**
 * Render score distribution context
 */
renderScoreDistribution(anime, scoreProfile) {
  if (!anime?.stats) return '';
  
  const avg = anime.stats.average;
  const profile = scoreProfile || Stats.defaultScoreProfile;
  
  // Calculate percentile
  const percentile = this.calculateAnimePercentile(avg, scoreProfile);
  
  return `
    <div class="score-distribution-section">
      <div class="detail-section-header">
        <h3>Score Context</h3>
        <span class="detail-section-note">Where this anime ranks</span>
      </div>
      
      <div class="score-context-cards">
        <div class="context-card">
          <div class="context-value">${avg.toFixed(2)}</div>
          <div class="context-label">Average Score</div>
          <div class="context-bar">
            <div class="context-fill" style="width: ${(avg / 5) * 100}%"></div>
          </div>
        </div>
        
        <div class="context-card">
          <div class="context-value">${percentile}th</div>
          <div class="context-label">Percentile</div>
          <div class="context-sub">${this.getPercentileLabel(percentile)}</div>
        </div>
        
        <div class="context-card">
          <div class="context-value">${Math.round(anime.stats.retentionScore)}%</div>
          <div class="context-label">Retention</div>
          <div class="context-bar">
            <div class="context-fill retention" style="width: ${anime.stats.retentionScore}%"></div>
          </div>
        </div>
      </div>
      
      <div class="percentile-visual">
        <div class="distribution-curve">
          <svg viewBox="0 0 400 100" class="curve-svg">
            <!-- Bell curve -->
            <path d="M 0,80 Q 100,80 200,20 Q 300,80 400,80" 
                  fill="none" 
                  stroke="var(--border-color)" 
                  stroke-width="2"/>
            <!-- Percentile marker -->
            <circle cx="${percentile * 4}" cy="${20 + (100 - percentile) * 0.3}" r="6" 
                    fill="var(--accent-primary)"/>
            <line x1="${percentile * 4}" y1="${20 + (100 - percentile) * 0.3}" 
                  x2="${percentile * 4}" y2="95" 
                  stroke="var(--accent-primary)" 
                  stroke-dasharray="4"/>
          </svg>
          <div class="percentile-labels">
            <span>Bottom 25%</span>
            <span>Average</span>
            <span>Top 25%</span>
          </div>
        </div>
      </div>
    </div>
  `;
}
```

---

## Gap D5: Timeline/Schedule View

### Problem
Weekly watcher use case is ignored. Season data exists but no calendar view for planning weekly watching.

### Solution
Add timeline view showing anime by season with calendar-style weekly breakdown.

### Technical Specifications
```javascript
/**
 * Render seasonal timeline view
 */
renderSeasonalTimeline(animeList, season) {
  const seasonAnime = animeList.filter(a => 
    `${a.season} ${a.year}` === season
  );
  
  if (seasonAnime.length === 0) return '';
  
  // Group by week (simulated - would need actual air dates)
  const weeklyGroups = this.groupAnimeByWeek(seasonAnime);
  
  return `
    <div class="seasonal-timeline">
      <div class="timeline-header">
        <h2>${season}</h2>
        <span class="timeline-count">${seasonAnime.length} anime</span>
      </div>
      
      <div class="timeline-calendar">
        ${weeklyGroups.map((week, idx) => `
          <div class="timeline-week">
            <div class="week-header">Week ${idx + 1}</div>
            <div class="week-anime">
              ${week.map(anime => `
                <div class="timeline-card" data-action="open-anime" data-anime-id="${anime.id}">
                  <img src="${anime.cover}" alt="" class="timeline-cover">
                  <div class="timeline-info">
                    <div class="timeline-title">${anime.title}</div>
                    <div class="timeline-meta">
                      <span class="retention-badge">${Math.round(anime.stats?.retentionScore || 0)}%</span>
                      <span>${anime.type || 'TV'}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
```

---

## Gap D6: Chart.js Integration

### Problem
`js/charts.js` exists with comprehensive chart functionality but is NOT wired in HTML. Module is completely unused.

### Solution
Add Chart.js CDN to index.html and integrate charts into the detail modal.

### Implementation
```html
<!-- In index.html, before other scripts -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>

<!-- Existing scripts -->
<script src="js/stats.js"></script>
<script src="js/charts.js"></script>
<script src="js/recommendations.js"></script>
<script src="js/app.js"></script>
```

---

## Implementation Priority

### Phase 1: Foundation (Critical - Unlocks Everything)
| Task | Gap | Effort | Impact |
|------|-----|--------|--------|
| Wire Chart.js in HTML | D6 | 10 min | **BLOCKER** - Required for all charts |
| Episode score bar chart | D1 | 2 hrs | High visual impact |
| Retention episode map | D2 | 3 hrs | Addresses core gap |

### Phase 2: Enhanced Visualizations
| Task | Gap | Effort | Impact |
|------|-----|--------|--------|
| Rolling average trend chart | D1 | 1 hr | Shows trajectory |
| Score distribution histogram | D1/D4 | 1.5 hrs | Context for scores |
| Percentile visualization | D4 | 1.5 hrs | Ranking context |

### Phase 3: Advanced Features
| Task | Gap | Effort | Impact |
|------|-----|--------|--------|
| Comparison mode | D3 | 4 hrs | Decision making aid |
| Comparison chart overlay | D3 | 2 hrs | Visual comparison |
| Seasonal timeline view | D5 | 3 hrs | Weekly watcher UX |

---

## New Files to Create

1. **`js/comparison.js`** - Comparison mode management (NEW)
2. **Update `js/app.js`** - Chart integration, retention map, comparison hooks
3. **Update `index.html`** - Chart.js CDN, new modal sections
4. **Update `css/styles.css`** - Chart containers, retention map, comparison styles

---

## Data Requirements

All visualizations use **existing data** from:
- `anime.episodes[]` - Episode scores
- `anime.stats` - Calculated metrics
- `scoreProfile` - Catalog-wide percentiles

No data pipeline changes required.

---

## Success Metrics

After implementation:
- **Engagement:** Time spent on detail modal increases (charts encourage exploration)
- **Understanding:** Users can articulate why an anime has a given retention score
- **Decision making:** Comparison feature used for watchlist planning
- **Discovery:** Timeline view increases seasonal anime engagement

---

## Visual Design Principles

1. **Color coding consistency:**
   - Green (excellent): 4.5-5.0
   - Indigo (good): 3.5-4.4
   - Yellow (average): 2.5-3.4
   - Red (poor): < 2.5

2. **Interactive elements:**
   - Hover for details
   - Click to switch chart views
   - Smooth transitions

3. **Mobile considerations:**
   - Charts scroll horizontally
   - Episode map uses compact grid
   - Touch-friendly tooltips

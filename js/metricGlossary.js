/**
 * Metric Glossary - Definitions and educational content for all metrics
 * Provides contextual help and detailed explanations
 */

const MetricGlossary = {
    /**
     * Metric definitions with detailed explanations
     */
    definitions: {
        retentionScore: {
            title: 'Retention Score (0-100)',
            shortDesc: 'How consistently viewers watch through the entire series',
            fullDesc: 'Measures how likely you are to finish the entire series without dropping off. Based on episode-by-episode analysis of viewer behavior.',
            components: [
                { name: '3-Episode Hook', weight: '35%', desc: 'Opening strength and initial engagement' },
                { name: 'Drop Safety', weight: '30%', desc: 'Low churn probability throughout' },
                { name: 'Momentum', weight: '20%', desc: 'Recent trajectory and pacing' },
                { name: 'Flow State', weight: '15%', desc: 'Episode-to-episode smoothness' }
            ],
            scale: [
                { range: '90-100', label: 'Exceptional', desc: 'Rare drop-offs, highly engaging' },
                { range: '75-89', label: 'Great', desc: 'Most viewers finish' },
                { range: '60-74', label: 'Good', desc: 'Minor weak points' },
                { range: '40-59', label: 'Mixed', desc: 'Notable quality swings' },
                { range: '0-39', label: 'Poor', desc: 'High drop-off risk' }
            ]
        },

        satisfactionScore: {
            title: 'Satisfaction Score (MAL)',
            shortDesc: 'Community rating from MyAnimeList',
            fullDesc: 'Overall quality rating from the MyAnimeList community. Represents how much viewers enjoyed the anime overall.',
            scale: [
                { range: '9.0-10', label: 'Masterpiece', desc: 'Universally acclaimed' },
                { range: '8.0-8.9', label: 'Excellent', desc: 'Highly recommended' },
                { range: '7.0-7.9', label: 'Good', desc: 'Worth watching' },
                { range: '6.0-6.9', label: 'Decent', desc: 'Has merit' },
                { range: 'Below 6', label: 'Mixed', desc: 'Divisive or flawed' }
            ]
        },

        flowState: {
            title: 'Flow State',
            shortDesc: 'How smoothly episodes transition into each other',
            fullDesc: 'Measures binge-worthiness. High flow means the show is easy to watch continuously without feeling disjointed.'
        },

        emotionalStability: {
            title: 'Emotional Stability',
            shortDesc: 'Consistency of emotional tone',
            fullDesc: 'Higher values mean more consistent emotional experience. Lower values indicate more dramatic tonal shifts.'
        },

        stressSpikes: {
            title: 'Stress Spikes',
            shortDesc: 'Sudden drops in episode quality',
            fullDesc: 'Count of episodes with significant quality drops (>= 1.5 points below average). Lower is better for casual viewing.'
        },

        worthFinishing: {
            title: 'Worth Finishing',
            shortDesc: 'Likelihood of satisfying conclusion',
            fullDesc: 'Combines finale strength, momentum, and narrative acceleration to predict if the ending pays off.'
        },

        finaleStrength: {
            title: 'Finale Strength',
            shortDesc: 'Quality of ending episodes',
            fullDesc: 'Compares the final quarter to earlier episodes. 50 is neutral, above 50 means the ending is stronger.'
        },

        momentum: {
            title: 'Momentum',
            shortDesc: 'Recent trajectory',
            fullDesc: 'Compares the last 3 episodes to the overall average. Positive means the show is getting better.'
        },

        churnRisk: {
            title: 'Churn Risk',
            shortDesc: 'Likelihood of viewer drop-off',
            fullDesc: 'Identifies where viewers might lose interest. Based on patterns of low-scoring episode clusters.'
        },

        habitBreakRisk: {
            title: 'Habit Break Risk',
            shortDesc: 'Longest chain of weak episodes',
            fullDesc: 'The longest consecutive run of below-median episodes per 10 episodes. Lower is better for maintaining interest.'
        },

        sharkJump: {
            title: 'Shark Jump Episode',
            shortDesc: 'Point of permanent decline',
            fullDesc: 'Identifies if there is a permanent drop in rolling average quality. Null means no significant permanent decline.'
        },

        comfortScore: {
            title: 'Comfort Score',
            shortDesc: 'Ease of viewing experience',
            fullDesc: 'Combines flow, emotional stability, easy entry, and low stress. Perfect for relaxing watches.'
        },

        barrierToEntry: {
            title: 'Barrier to Entry',
            shortDesc: 'How easy the first episodes are',
            fullDesc: 'Standard deviation of first 5 episodes. Lower means easier to get into.'
        },

        productionQualityIndex: {
            title: 'Production Quality Index',
            shortDesc: 'Overall production assessment',
            fullDesc: 'Composite of average quality, consistency, trend, hook strength, and low churn risk.'
        },

        qualityTrend: {
            title: 'Quality Trend',
            shortDesc: 'Direction of quality over time',
            fullDesc: 'Linear regression slope for the second half. Can indicate if the show improves or declines.'
        },

        controversyPotential: {
            title: 'Controversy Potential',
            shortDesc: 'How divisive the anime is',
            fullDesc: 'Based on score range and extreme scores. Higher means more polarized opinions.'
        }
    },

    /**
     * Get a metric definition by key
     */
    get(key) {
        return this.definitions[key] || null;
    },

    /**
     * Get tooltip content for a metric
     */
    getTooltip(key, value) {
        const def = this.get(key);
        if (!def) return null;

        let content = `<div class="tooltip-metric-title">${def.title}</div>`;

        if (value !== undefined && value !== null) {
            const formattedValue = this.formatValue(key, value);
            content += `<div class="tooltip-metric-value">${formattedValue}</div>`;
        }

        content += `<div class="tooltip-metric-desc">${def.shortDesc}</div>`;

        if (def.scale && value !== undefined) {
            const interpretation = this.interpretValue(key, value);
            if (interpretation) {
                content += `<div class="tooltip-metric-interpretation">${interpretation.label} — ${interpretation.desc}</div>`;
            }
        }

        return content;
    },

    /**
     * Format a metric value for display
     */
    formatValue(key, value) {
        if (value === null || value === undefined) return 'N/A';

        if (key === 'retentionScore' || key === 'flowState' || key === 'emotionalStability' ||
            key === 'worthFinishing' || key === 'finaleStrength' || key === 'comfortScore' ||
            key === 'productionQualityIndex' || key === 'controversyPotential') {
            return `${Math.round(value)}%`;
        }

        if (key === 'satisfactionScore') {
            return `${value.toFixed(1)}/10`;
        }

        if (key === 'momentum') {
            const sign = value > 0 ? '+' : '';
            return `${sign}${Math.round(value)}`;
        }

        if (key === 'stressSpikes' || key === 'habitBreakRisk') {
            return value.toFixed(1);
        }

        return String(value);
    },

    /**
     * Interpret a value based on scale definitions
     */
    interpretValue(key, value) {
        const def = this.get(key);
        if (!def || !def.scale) return null;

        for (const item of def.scale) {
            const [min, max] = this.parseRange(item.range);
            if (value >= min && value <= max) {
                return item;
            }
        }

        return null;
    },

    /**
     * Parse a range string like "90-100" or "Below 6"
     */
    parseRange(rangeStr) {
        if (rangeStr.toLowerCase().includes('below')) {
            const num = parseFloat(rangeStr.replace(/[^0-9.]/g, ''));
            return [0, num];
        }

        const parts = rangeStr.split('-').map(p => parseFloat(p.trim()));
        if (parts.length === 2) {
            return parts;
        }

        return [0, 100];
    },

    /**
     * Get detailed content for metric help modal
     */
    getDetailedContent(key) {
        const def = this.get(key);
        if (!def) return null;

        let html = `
      <div class="metric-help-header">
        <h3>${def.title}</h3>
        <p class="metric-help-short">${def.shortDesc}</p>
      </div>
      <div class="metric-help-body">
        <p class="metric-help-full">${def.fullDesc}</p>
    `;

        if (def.components) {
            html += `
        <div class="metric-help-components">
          <h4>Components</h4>
          <ul>
            ${def.components.map(c => `
              <li>
                <strong>${c.name}</strong> (${c.weight}): ${c.desc}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
        }

        if (def.scale) {
            html += `
        <div class="metric-help-scale">
          <h4>Scale</h4>
          <div class="metric-scale-items">
            ${def.scale.map(s => `
              <div class="metric-scale-item">
                <span class="metric-scale-range">${s.range}</span>
                <span class="metric-scale-label">${s.label}</span>
                <span class="metric-scale-desc">${s.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
        }

        html += '</div>';
        return html;
    },

    /**
     * Get all metric keys for advanced stats section
     */
    getAdvancedStatsCategories() {
        return [
            {
                id: 'watchExperience',
                title: 'Watch Experience',
                description: 'For casual viewers',
                metrics: [
                    { key: 'flowState', label: 'Flow State' },
                    { key: 'emotionalStability', label: 'Emotional Stability' },
                    { key: 'stressSpikes', label: 'Stress Spikes' },
                    { key: 'comfortScore', label: 'Comfort Score' }
                ]
            },
            {
                id: 'completionOutlook',
                title: 'Completion Outlook',
                description: 'For completionists',
                metrics: [
                    { key: 'worthFinishing', label: 'Worth Finishing' },
                    { key: 'finaleStrength', label: 'Finale Strength' },
                    { key: 'momentum', label: 'Momentum' }
                ]
            },
            {
                id: 'qualityAnalysis',
                title: 'Quality Analysis',
                description: 'For enthusiasts',
                metrics: [
                    { key: 'qualityTrend', label: 'Quality Trend' },
                    { key: 'productionQualityIndex', label: 'Production Quality' }
                ]
            },
            {
                id: 'riskFactors',
                title: 'Risk Factors',
                description: 'Honest assessment',
                metrics: [
                    { key: 'churnRisk', label: 'Churn Risk' },
                    { key: 'habitBreakRisk', label: 'Habit Break Risk' },
                    { key: 'sharkJump', label: 'Shark Jump' }
                ]
            }
        ];
    },

    /**
     * Render help button for a metric
     */
    renderHelpButton(key, size = 'sm') {
        return `
      <button class="metric-help-btn metric-help-btn--${size}" 
              data-action="metric-help" 
              data-metric="${key}"
              aria-label="Learn more about ${this.get(key)?.title || key}">
        <span aria-hidden="true">?</span>
      </button>
    `;
    }
};

// Expose to global scope
window.MetricGlossary = MetricGlossary;

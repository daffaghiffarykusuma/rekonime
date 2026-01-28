# Category B: User Onboarding & Education Plan

## Gap Analysis Summary

| Gap ID | Description | Severity | Current State |
|--------|-------------|----------|---------------|
| B1 | No First-Time User Flow | 🔴 High | Users land directly on catalog; no guided introduction |
| B2 | Retention Score Undefined | 🔴 High | Basic tooltip exists but no deep education on 0-100 scale |
| B3 | No Context for MAL | 🟡 Medium | Assumes familiarity with MyAnimeList |
| B4 | Missing Scoring Methodology | 🟡 Medium | No About or methodology page explaining episode scoring |
| B5 | No Filter Guidance | 🟡 Medium | Filter modal opens but no suggested starting points |
| B6 | Stats Overload Without Context | 🟡 Medium | 50+ metrics calculated, only 3-4 shown |

---

## Design Philosophy

**The sophisticated scoring system is Rekonime's differentiator—but it's under-communicated.**

Instead of expecting users to already understand the value proposition, we need to:
1. **Educate progressively** - Teach concepts as users encounter them
2. **Show, don't just tell** - Use examples and visual explanations
3. **Make it skippable** - Respect power users while helping newcomers
4. **Surface hidden value** - Reveal the depth of metrics without overwhelming

---

## Implementation Plan

### Phase 1: First-Time User Onboarding (B1)

#### 1.1 Welcome Modal / Tour System
Create an onboarding experience that activates on first visit (localStorage flag).

**Components:**
- `js/onboarding.js` - Onboarding state management and tour logic
- Progressive disclosure: 3-4 steps, skippable any time

**Tour Steps:**
```
Step 1: Welcome
- "Find anime you'll actually finish"
- Brief value prop: Retention + Satisfaction scores
- CTA: "Take a quick tour" or "Start exploring"

Step 2: Understanding Retention Score (addresses B2)
- Visual: Sample retention meter with explanation
- "0-100 scale measuring watch-through consistency"
- "Higher = more likely you'll finish the whole series"
- Example: Compare low vs high retention anime

Step 3: Understanding Satisfaction Score (addresses B3)
- Brief MAL explanation: "Community ratings from MyAnimeList"
- Why two scores matter: "Retention = consistency, Satisfaction = quality"

Step 4: Finding Your Next Watch
- Highlight search and filters
- Mention bookmarking feature
- Final CTA to catalog
```

**Technical Implementation:**
```javascript
// js/onboarding.js
const Onboarding = {
  storageKey: 'rekonime.onboarding',
  steps: ['welcome', 'retention', 'satisfaction', 'discovery'],
  
  hasCompleted() {
    return localStorage.getItem(this.storageKey) === 'completed';
  },
  
  markCompleted() {
    localStorage.setItem(this.storageKey, 'completed');
  },
  
  startTour() { /* ... */ },
  nextStep() { /* ... */ },
  skipTour() { /* ... */ }
};
```

#### 1.2 First-Visit UI Adjustments
- Show onboarding modal on first visit
- Add "Take Tour" button to header (visible until completed)
- Add "Help" icon in header for re-triggering tour

---

### Phase 2: Deep Metric Education (B2, B3, B6)

#### 2.1 Enhanced Tooltip System
Upgrade existing tooltips to be more educational:

**Current (Basic):**
```
Retention Score
How consistently people keep watching across episodes.
```

**Enhanced (Educational):**
```
Retention Score: 87%
━━━━━━━━━━━━━━━━━━
How likely you are to finish the entire series.

Based on:
• Strong opening episodes
• Low drop-off risk
• Consistent pacing

87% = Excellent (top 15% of anime)
```

#### 2.2 Expandable Metric Details in Detail Modal
Add an "Advanced Stats" expandable section in the anime detail modal to surface the 50+ calculated metrics in a digestible way.

**Categories to Surface:**

| Category | Metrics | User Value |
|----------|---------|------------|
| Watch Experience | Flow State, Emotional Stability, Stress Spikes | For casual viewers |
| Completion Outlook | Worth Finishing, Finale Strength, Momentum | For completionists |
| Quality Analysis | Quality Trend, Production Quality Index | For enthusiasts |
| Risk Factors | Churn Risk, Habit Break Risk, Shark Jump | Honest assessment |

**Implementation:**
```html
<!-- In detail modal -->
<div class="detail-advanced-stats">
  <button class="expand-toggle" aria-expanded="false">
    Advanced Stats 
    <span class="hint">(50+ metrics analyzed)</span>
  </button>
  <div class="advanced-stats-content" hidden>
    <div class="stats-category">
      <h4>Watch Experience</h4>
      <div class="stat-row">
        <span class="stat-name">Flow State</span>
        <div class="stat-bar"><span style="width: 85%"></span></div>
        <span class="stat-value">85%</span>
        <button class="stat-help" data-metric="flowState">?</button>
      </div>
      <!-- More stats... -->
    </div>
  </div>
</div>
```

#### 2.3 Metric Glossary / Help System
Create a comprehensive but scannable glossary of all metrics.

**Access Points:**
- "?" buttons next to each metric in advanced stats
- Dedicated "About Scores" link in footer/header
- Contextual help within tooltips

**Content Structure:**
```
Retention Score (0-100)
━━━━━━━━━━━━━━━━━━━━━━
Measures how consistently viewers watch through 
an entire series without dropping off.

Components:
• 3-Episode Hook (35%): Opening strength
• Drop Safety (30%): Low churn probability  
• Momentum (20%): Recent trajectory
• Flow State (15%): Episode-to-episode smoothness

Scale:
90-100 = Exceptional (rare drop-offs)
75-89  = Great (most viewers finish)
60-74  = Good (minor weak points)
40-59  = Mixed (notable quality swings)
0-39   = Poor (high drop-off risk)
```

---

### Phase 3: Methodology & Transparency (B4)

#### 3.1 About / Methodology Page
Create a dedicated page explaining Rekonime's approach.

**Sections:**
1. **Our Mission** - Why we focus on retention, not just ratings
2. **How Scoring Works** - Episode-level analysis methodology
3. **Data Sources** - MAL integration, episode data
4. **The Two-Score System** - Why Retention + Satisfaction together
5. **FAQ** - Common questions

**URL:** `/about` or `#about` modal

#### 3.2 Scoring Methodology Callouts
Add subtle links throughout the UI:
- "How we calculate this" link in detail modal
- Brief methodology note in recommendations section
- Data source attribution near MAL scores

---

### Phase 4: Filter Discovery & Guidance (B5)

#### 4.1 Suggested Starting Points
Add preset filter combinations to help users discover the catalog.

**Implementation:**
```html
<!-- In filter modal or as quick chips -->
<div class="filter-presets">
  <span class="presets-label">Quick picks:</span>
  <button class="preset-chip" data-preset="binge-worthy">
    🍿 Binge-Worthy
  </button>
  <button class="preset-chip" data-preset="critical-darlings">
    ⭐ Critical Darlings
  </button>
  <button class="preset-chip" data-preset="hidden-gems">
    💎 Hidden Gems
  </button>
  <button class="preset-chip" data-preset="easy-watches">
    😌 Easy Watches
  </button>
</div>
```

**Preset Definitions:**
```javascript
const FILTER_PRESETS = {
  'binge-worthy': {
    label: 'Binge-Worthy',
    description: 'High flow state, low stress spikes',
    filters: {}, // Sort by flowState
    sort: 'flowState',
    minRetention: 75
  },
  'critical-darlings': {
    label: 'Critical Darlings',
    description: 'Top satisfaction scores from MAL',
    filters: {},
    sort: 'satisfaction',
    minMalScore: 8.0
  },
  'hidden-gems': {
    label: 'Hidden Gems',
    description: 'High retention, lower MAL scores',
    filters: {},
    sort: 'retention',
    retentionMin: 80,
    malMax: 7.5
  },
  'easy-watches': {
    label: 'Easy Watches',
    description: 'Low barrier to entry, comfortable',
    filters: { genres: ['Slice of Life', 'Comedy'] },
    sort: 'comfort',
    minComfort: 70
  }
};
```

#### 4.2 Filter Education Tooltips
Add contextual help within the filter modal explaining what each filter category means.

---

### Phase 5: Contextual Education Throughout UI

#### 5.1 Empty State Education
Enhance the Discovery Garden empty state to educate about filters:

```html
<div class="discovery-garden" id="discovery-garden">
  <!-- ... existing petal animation ... -->
  <div class="discovery-content">
    <h3>Discover Your Next Journey</h3>
    <p>Like cherry blossoms, great anime moments are fleeting but unforgettable.</p>
    
    <!-- NEW: Quick education cards -->
    <div class="discovery-tips">
      <div class="tip-card">
        <span class="tip-icon">📊</span>
        <h4>Two Numbers Matter</h4>
        <p>Retention = consistency. Satisfaction = quality.</p>
        <button class="tip-cta" data-action="learn-scores">Learn more</button>
      </div>
      <div class="tip-card">
        <span class="tip-icon">🎭</span>
        <h4>Filter by Mood</h4>
        <p>Use Genre and Theme chips to find your vibe.</p>
        <button class="tip-cta" data-action="scroll-to-filters">Try filters</button>
      </div>
    </div>
  </div>
</div>
```

#### 5.2 Recommendation Context
Add context to the recommendations section explaining why these anime are recommended:

```html
<div class="recommendations-header">
  <h2>Recommended for you</h2>
  <p class="section-subtitle">
    Top picks with high Retention Scores (you'll finish them)
    and solid MAL Satisfaction (they're actually good).
  </p>
  <button class="help-link" data-action="explain-recommendations">
    How we pick these
  </button>
</div>
```

#### 5.3 Anime Card Educational Elements
Add subtle educational cues on anime cards:

- **Retention meter** - Color-coded with legend
- **Badges with explanations** - Tooltips explaining "Keeps You Hooked", "Hidden Gem", etc.
- **MAL score context** - "8.7/10 on MyAnimeList" instead of just "8.7/10"

---

## Technical Implementation Details

### New Files to Create

```
js/
  onboarding.js        # Tour system and onboarding logic
  metricGlossary.js    # Metric definitions and help content
  filterPresets.js     # Preset filter configurations

css/
  onboarding.css       # Onboarding modal and tour styles
  metric-help.css      # Tooltip and glossary styles

pages/ (or as modals)
  about.html           # Methodology page
  glossary.html        # Full metric glossary
```

### LocalStorage Keys

```javascript
'rekonime.onboarding'      // 'completed' | 'skipped' | null
'rekonime.tourStep'        // Current tour step (0-3)
'rekonime.helpDismissed'   // Array of dismissed help tips
```

### Event Tracking (Optional)

For understanding onboarding effectiveness:
- `onboarding_started`
- `onboarding_completed`
- `onboarding_skipped` (with step number)
- `metric_help_opened` (with metric name)
- `filter_preset_used` (with preset name)

---

## Success Metrics

The onboarding and education improvements are successful when:

- [ ] **B1**: First-time users see onboarding within 5 seconds of landing
- [ ] **B2**: 80%+ of users can explain what Retention Score means after onboarding
- [ ] **B3**: MAL context is provided wherever MAL scores appear
- [ ] **B4**: Methodology page exists and is accessible from main UI
- [ ] **B5**: Filter presets are used in 20%+ of filter interactions
- [ ] **B6**: Advanced stats section surfaces 15+ metrics in detail modal

---

## Integration with Existing Code

### Changes to `js/app.js`

```javascript
// In App.init()
async init() {
  // ... existing code ...
  
  // Check and trigger onboarding for first-time users
  if (!Onboarding.hasCompleted()) {
    Onboarding.startTour();
  }
  
  // ... rest of init ...
}

// New method for showing methodology modal
showMethodology() { /* ... */ }

// New method for applying filter presets
applyFilterPreset(presetKey) { /* ... */ }
```

### Changes to `index.html`

```html
<!-- Add onboarding modal container -->
<div id="onboarding-modal" class="onboarding-overlay" aria-hidden="true">
  <div class="onboarding-content">
    <!-- Populated by onboarding.js -->
  </div>
</div>

<!-- Add help icon to header -->
<button id="help-toggle" class="btn btn-icon" aria-label="Help">
  <span aria-hidden="true">?</span>
</button>

<!-- Add script includes -->
<script src="js/onboarding.js" defer></script>
<script src="js/metricGlossary.js" defer></script>
<script src="js/filterPresets.js" defer></script>
```

---

## Implementation Priority

### Phase 1 (Critical - High Impact)
1. Welcome modal / tour system (B1)
2. Enhanced Retention Score tooltips (B2)
3. MAL context additions (B3)

### Phase 2 (Important - Medium-High Impact)
4. About / Methodology page (B4)
5. Filter presets (B5)
6. Advanced stats section (B6)

### Phase 3 (Polish - Medium Impact)
7. Full metric glossary
8. Educational empty states
9. Recommendation context

---

## Design Considerations

### Sakura Theme Alignment
- Onboarding modals use sakura color palette
- Educational tooltips have subtle petal accents
- Progress indicators use sakura pink gradient
- All new UI elements match Category A redesign

### Accessibility
- Tour steps are keyboard navigable
- All educational content respects `prefers-reduced-motion`
- Tooltips are screen reader friendly
- High contrast maintained for readability

### Mobile Considerations
- Tour adapts to single-column on mobile
- Tooltips become bottom sheets on small screens
- Filter presets as horizontal scroll chips
- Swipe gestures for onboarding steps

---

## Notes

- **Progressive Disclosure**: Don't show everything at once. Layer education based on user actions.
- **Respect Power Users**: All onboarding is skippable and dismissible permanently.
- **Keep it Brief**: No step should require more than 30 seconds to read.
- **Visual Examples**: Use real anime examples to illustrate concepts (e.g., "Attack on Titan has 94% retention").

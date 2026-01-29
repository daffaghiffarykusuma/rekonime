# Accessibility (a11y) Gaps Remediation Plan

## Gap Analysis Summary

| Criterion | Current State | Gap | Severity |
|-----------|---------------|-----|----------|
| 1.3.1 Info/Relationships | Some ARIA labels | Inconsistent on dynamically loaded content | 🟡 Medium |
| 2.1.1 Keyboard | Basic support | Modal focus trap incomplete | 🔴 High |
| 2.2.2 Pause/Stop | No animations paused | Auto-playing trailers can't be paused | 🟡 Medium |
| 4.1.3 Status Messages | Some aria-live | Toast notifications not announced | 🟡 Medium |

## Screen Reader Issues Identified

1. **Trailer iframe lacks title attribute** in some states
2. **Star ratings use Unicode characters** (&#9733;) without text alternatives
3. **Loading skeletons not marked with aria-busy**
4. **Focus trap handlers not cleaned up** if modal closes unexpectedly

---

## Remediation Tasks

### 1. Focus Management Fixes (HIGH Priority)

**Problem:** Focus trap handlers may not be cleaned up if modal closes unexpectedly.

**Location:** `js/app.js` lines 656-714

**Current Code Issues:**
- `activateModalFocus()` adds keydown listener but cleanup is only in `deactivateModalFocus()`
- If modal closes via unexpected path (e.g., browser back button), handler persists
- `modalFocusState.handler` is overwritten if multiple modals open without proper cleanup

**Required Changes:**

#### 1.1 Fix Handler Cleanup in `closeDetailModal()`
```javascript
// Ensure deactivateModalFocus is called in ALL modal close paths
closeDetailModal({ updateUrl = true } = {}) {
    // ... existing code ...
    this.deactivateModalFocus('detail-modal', { returnFocus: true }); // ADD THIS
    this.setModalVisibility('detail-modal', false); // Move after cleanup
    // ... rest of existing code ...
}
```

#### 1.2 Add Cleanup on `beforeunload` Event
```javascript
// Add to App.init()
window.addEventListener('beforeunload', () => {
    if (this.modalFocusState.activeId) {
        this.deactivateModalFocus(this.modalFocusState.activeId, { returnFocus: false });
    }
});
```

#### 1.3 Fix KeyboardShortcuts Focus Trap
**Location:** `js/keyboardShortcuts.js` lines 338-356

The `setupFocusTrap` method creates listeners that are never removed. Refactor to:
```javascript
setupFocusTrap(modal) {
    const handler = (e) => { /* existing logic */ };
    modal.addEventListener('keydown', handler);
    // Store handler for cleanup
    modal._focusTrapHandler = handler;
}

// In closeShortcutsModal():
if (modal._focusTrapHandler) {
    modal.removeEventListener('keydown', modal._focusTrapHandler);
}
```

---

### 2. Screen Reader Text Alternatives (MEDIUM Priority)

#### 2.1 Star Ratings - Add Visually Hidden Text
**Location:** Multiple files using `&#9733;` (bookmark buttons)

**Affected Files:**
- `js/app.js` line 2828: Bookmark toggle button
- `js/app.js` line 3644: Modal bookmark button
- `bookmarks.html` (if applicable)

**Fix Pattern:**
```html
<!-- Before -->
<button aria-label="Add bookmark">&#9733;</button>

<!-- After -->
<button aria-label="Add bookmark">
    <span aria-hidden="true">&#9733;</span>
    <span class="visually-hidden">Bookmark this anime</span>
</button>
```

**CSS Addition to `css/themes.css`:**
```css
.visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

#### 2.2 Trailer iframe Title Attribute
**Location:** `js/app.js` lines 3893-3901

**Current Issue:** Title is set but may be insufficient when iframe source changes.

**Required Fix:**
```javascript
// Ensure consistent title in renderTrailerSection
const title = anime?.title ? `Trailer for ${anime.title}` : 'Anime trailer';
// Title attribute is already present - verify it's descriptive enough
```

#### 2.3 Loading Skeletons - Add aria-busy
**Location:** `js/app.js` lines 1152-1173

**Current Code:** Partially implemented for rankings only.

**Required Fix:**
```javascript
renderLoadingState() {
    const grid = document.getElementById('anime-grid');
    const recommendations = document.getElementById('recommendations-grid');
    
    if (grid) {
        grid.classList.add('is-loading');
        grid.setAttribute('aria-busy', 'true'); // ADD THIS
    }
    if (recommendations) {
        recommendations.classList.add('is-loading');
        recommendations.setAttribute('aria-busy', 'true'); // ADD THIS
    }
}

// Also add removal when loading completes in render methods
```

---

### 3. Trailer Pause/Stop Controls (MEDIUM Priority)

**WCAG 2.2.2 Requirement:** Users must be able to pause, stop, or hide moving content.

**Location:** `js/app.js` lines 3873-4036

**Current Implementation:**
- Auto-plays when scrolled into view (if setting enabled)
- No pause/stop button provided
- Only stops when modal closes or user scrolls away

**Required Implementation:**

#### 3.1 Add Pause/Play Button to Trailer Section
```javascript
renderTrailerSection(anime) {
    // ... existing code ...
    return `
        <div class="detail-trailer" id="detail-trailer">
            <div class="detail-section-header">
                <h3>Trailer</h3>
                <div class="trailer-controls">
                    <button class="trailer-pause-btn" id="trailer-pause" 
                            aria-label="Pause trailer" aria-pressed="false">
                        <span class="pause-icon" aria-hidden="true">⏸</span>
                        <span class="play-icon" aria-hidden="true" hidden>▶</span>
                    </button>
                    <a class="trailer-link" href="${safeUrl}" target="_blank" 
                       rel="noopener noreferrer">Watch on YouTube</a>
                </div>
            </div>
            <!-- ... rest of trailer markup ... -->
        </div>
    `;
}
```

#### 3.2 Add Pause/Resume Functions
```javascript
// Add to App object
toggleTrailerPlayback() {
    const iframe = document.querySelector('.detail-trailer iframe');
    if (!iframe) return;
    
    if (iframe.dataset.paused === 'true') {
        this.resumeTrailerPlayback(iframe);
    } else {
        this.pauseTrailerPlayback(iframe);
    }
}

pauseTrailerPlayback(iframe) {
    // YouTube API approach (preferred):
    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    
    // Fallback: reload without autoplay
    const embedSrc = iframe.dataset.embedSrc;
    if (embedSrc) {
        iframe.src = embedSrc; // Removes autoplay param
    }
    iframe.dataset.paused = 'true';
    this.updatePauseButtonState(true);
}

resumeTrailerPlayback(iframe) {
    const embedSrc = iframe.dataset.embedSrc;
    if (embedSrc && this.shouldAutoplayTrailers()) {
        iframe.src = this.buildAutoplayEmbedUrl(embedSrc);
    }
    iframe.dataset.paused = 'false';
    this.updatePauseButtonState(false);
}

updatePauseButtonState(isPaused) {
    const btn = document.getElementById('trailer-pause');
    if (!btn) return;
    
    btn.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
    btn.setAttribute('aria-label', isPaused ? 'Resume trailer' : 'Pause trailer');
    btn.querySelector('.pause-icon').hidden = isPaused;
    btn.querySelector('.play-icon').hidden = !isPaused;
}
```

#### 3.3 CSS for Trailer Controls
```css
.trailer-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.trailer-pause-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid var(--border-primary);
    border-radius: 50%;
    background: var(--bg-secondary);
    cursor: pointer;
}

.trailer-pause-btn:focus {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
}
```

---

### 4. Status Messages with aria-live (MEDIUM Priority)

**WCAG 4.1.3:** Status messages must be announced by assistive technology.

**Location:** `js/app.js` and `js/serviceWorker.js`

**Current Toast Notifications:**
- Offline indicator (line 313-316 in index.html)
- Update notification (line 319-325 in index.html)
- Toast messages not consistently announced

**Required Implementation:**

#### 4.1 Create Toast Notification System with ARIA Live Region
```javascript
// Add to App object
showToast(message, { type = 'info', duration = 5000 } = {}) {
    const toastId = `toast-${Date.now()}`;
    const ariaLive = type === 'error' || type === 'success' ? 'assertive' : 'polite';
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', ariaLive);
    toast.setAttribute('aria-atomic', 'true');
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Announce to screen readers
    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });
    
    // Auto-dismiss
    setTimeout(() => {
        this.dismissToast(toastId);
    }, duration);
    
    return toastId;
}

dismissToast(toastId) {
    const toast = document.getElementById(toastId);
    if (!toast) return;
    
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
}
```

#### 4.2 CSS for Toast Notifications
```css
.toast {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(100px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    z-index: 1000;
}

.toast.is-visible {
    transform: translateY(0);
    opacity: 1;
}

.toast--error {
    border-color: var(--error);
    background: var(--error-bg);
}

.toast--success {
    border-color: var(--success);
    background: var(--success-bg);
}
```

#### 4.3 Update Existing Notifications
**Offline Indicator:** Already has `aria-live="polite"` - verify it announces.

**Update Notification:** Already has `role="alert"` and `aria-live="polite"` - verify implementation.

**Bookmark Notifications:**
```javascript
// In toggleBookmark method
const message = isBookmarked 
    ? `${anime.title} added to bookmarks`
    : `${anime.title} removed from bookmarks`;
this.showToast(message, { type: 'success' });
```

---

### 5. Dynamically Loaded Content - ARIA Labels (MEDIUM Priority)

**Problem:** ARIA labels are inconsistent on dynamically loaded content.

**Affected Areas:**
- Filter pills (lines 2325-2337 in `js/app.js`)
- Quick chips (lines 2374-2380 in `js/app.js`)
- Recommendation cards (lines 3048-3094 in `js/app.js`)
- Similar anime cards (lines 3498-3540 in `js/app.js`)

**Required Fixes:**

#### 5.1 Add aria-pressed to Toggle Buttons
```javascript
// Filter pills
`<button class="filter-pill ${isActive ? 'active' : ''}"
    data-action="toggle-filter"
    data-filter-type="${safeType}"
    data-filter-value="${safeOptionAttr}"
    aria-pressed="${isActive ? 'true' : 'false'}"
    aria-label="${isActive ? 'Remove' : 'Add'} ${safeOptionText} filter">
    ${safeOptionText}
</button>`
```

#### 5.2 Add Descriptive aria-label to Cards
```javascript
// Anime cards
`<div class="anime-card"
    data-action="open-anime"
    data-anime-id="${safeId}"
    tabindex="0"
    role="button"
    aria-label="View details for ${safeTitle}, ${safeYear}">
    <!-- card content -->
</div>`
```

---

## Testing Approach

### Automated Testing
1. **axe DevTools** - Browser extension for WCAG validation
2. **Lighthouse** - Built-in accessibility audit
3. **Pa11y** - Command-line accessibility testing

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] All interactive elements reachable via Tab
- [ ] Tab order follows visual layout
- [ ] Modal focus trap works correctly
- [ ] Escape key closes modals
- [ ] Arrow keys navigate within dropdowns

#### Screen Reader Testing
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)

#### Focus Management
- [ ] Focus indicator visible on all interactive elements
- [ ] Focus returns to trigger after modal closes
- [ ] No focus loss when dynamic content loads

#### Color and Contrast
- [ ] Minimum 4.5:1 contrast for normal text
- [ ] Minimum 3:1 contrast for large text
- [ ] Information not conveyed by color alone

---

## Implementation Order

1. **Immediate (HIGH Priority)**
   - Fix focus trap cleanup in modal close handlers
   - Add aria-busy to loading skeletons

2. **Short-term (MEDIUM Priority)**
   - Add pause/play controls to trailers
   - Implement toast notification system with aria-live
   - Add visually hidden text to star ratings

3. **Long-term (LOW Priority)**
   - Enhance ARIA labels on dynamically loaded content
   - Comprehensive screen reader testing

---

## Success Criteria

- All modals properly trap and return focus
- Screen readers announce dynamic content changes
- Trailers can be paused by keyboard and screen reader users
- All interactive elements have accessible names
- WCAG 2.1 Level AA compliance achieved

# Data & State Management Refactoring Plan (Updated)

## Executive Summary
This plan updates the original proposal to reflect the current codebase (Store + CacheManager already exist). The focus is now on consolidating storage access, adding schema validation, and introducing bounded cache eviction for descriptions. IndexedDB and an offline mutation queue are deferred as optional follow-ups.

## Current State (as of 2026-01-31)
- Store exists in `js/core/store.js` and is wired in `js/app.js` via `initializeStore()` and `bindStoreState()`.
- CacheManager exists in `js/services/cache-manager.js` with safe localStorage access and TTL support.
- Several modules still access localStorage directly (App, ThemeManager, Onboarding, KeyboardShortcuts, Reviews, Discovery, Recommendations).

## Gaps To Close
1. Inconsistent storage access (direct localStorage + CacheManager).
2. No shared schema validation for persisted JSON payloads.
3. Description cache has TTL but no size-bound eviction.
4. Storage failures are silent and hard to detect.

## Target Outcome
- All storage reads/writes go through CacheManager.
- Persisted JSON uses a schema validator on read/write.
- Description cache uses bounded LRU eviction with a small index.
- Existing behavior is preserved with backward-compatible parsing.

## Implementation Plan

### Phase 1: Consolidate Storage + Validation (Priority: High)
- Add SchemaValidator service to validate JSON payloads.
- Extend CacheManager with validate options for set/get.
- Register schemas for:
  - `rekonime.settings`
  - `rekonime.bookmarks`
  - `rekonime.recMode`
  - `rekonime.surpriseHistory`
  - `rekonime:description:index` (new)
- Replace direct localStorage usage in modules with CacheManager calls.

### Phase 2: Cache Eviction for Descriptions (Priority: Medium)
- Add an index for description cache keys.
- Update description cache reads/writes to record access.
- Enforce max entries (default: 100) with LRU eviction.
- Keep TTL behavior intact.

### Phase 3: Optional Future Work (Deferred)
- IndexedDB wrapper for larger caches.
- Offline mutation queue for bookmarks if/when server sync is introduced.

## File Changes
- Add `js/services/schema-validator.js`
- Update `js/services/cache-manager.js`
- Update `js/app.js`, `js/reviews.js`, `js/discovery.js`, `js/recommendations.js`,
  `js/onboarding.js`, `js/keyboardShortcuts.js`, `js/themeManager.js`
- Update `AGENTS.md` graph and flowchart

## Success Metrics
- 100% of persisted keys pass validation on read/write.
- Zero direct localStorage access in app modules.
- Description cache bounded to max entries with stable performance.

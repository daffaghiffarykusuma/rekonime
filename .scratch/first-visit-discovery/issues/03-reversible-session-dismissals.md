# 03: Skip and restore titles within a Discovery session

**What to build:** A viewer can use Skip for now, undo it, or review and restore skipped recommendations without changing lasting taste or Watchlist history.

**Blocked by:** None (can start immediately).

**Status:** in-progress

- [x] Expose Skip for now on recommendation cards and remove dismissed titles from current recommendation candidates.
- [x] Session Dismissal works with or without a selected Viewing Intent.
- [x] Temporary skipping never writes lasting Taste Profile preferences or creates or changes a Watchlist Entry.
- [x] Provide immediate Undo and a keyboard-operable way to review and restore titles skipped during the session.
- [x] Preserve dismissals through same-tab reloads and changes of Viewing Intent.
- [x] Reuse the existing four-hour sliding inactivity boundary and reject expired dismissals when the session is next used.
- [x] A genuinely fresh tab session starts without dismissals; verify and document browser session-restoration behavior before promising tab-close deletion.
- [x] Keep Session Dismissal outside personal-data backups and enduring preference inference.
- [x] Extend the existing discovery/session boundary only as needed; verify dismissal, recovery, isolation, goal changes, reload, and clock-controlled expiry through public behavior.
- [ ] Inspect readable mobile controls and focus/announcements after dismissal and restoration.

## Implementation evidence

Implemented Session Dismissal in the existing Viewing Intent session runtime. Discovery cards expose Skip for now, a persistent Undo action, and a keyboard-operable review/restore list. Session storage preserves the list without writing Taste Profile or Watchlist state. All reads reject expired data before activity can renew it; App Shell rendering reads without renewal, while explicit actions keep the shared four-hour sliding window alive.

- Seven public Viewing Intent/session tests pass, including no-goal dismissal, reload, goal change/clear, clock-controlled sliding expiry, fresh storage, and storage refusal.
- Existing App Discovery integration check passes.
- Type checking passes.
- The mobile browser journey passes at 390px, covering keyboard Undo and restore, focus, live status, reload, intent changes, fresh-tab isolation, unchanged lasting storage, and restore-button viewport containment.
- Same-tab reload and a fresh browser tab are verified. Browser session recovery and duplicated/opener tabs may retain session storage; no tab-close deletion promise is made.
- Final rendered desktop/mobile inspection remains for the integration branch, so the visual acceptance criterion remains unchecked.

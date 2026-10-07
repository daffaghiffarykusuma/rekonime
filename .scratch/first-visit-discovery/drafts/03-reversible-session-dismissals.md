# 03: Skip and restore titles within a Discovery session

**What to build:** A viewer can use Skip for now, undo it, or review and restore skipped recommendations without changing lasting taste or Watchlist history.

**Blocked by:** None (can start immediately).

**Status:** draft, pending breakdown approval

- [ ] Expose Skip for now on recommendation cards and remove dismissed titles from current recommendation candidates.
- [ ] Session Dismissal works with or without a selected Viewing Intent.
- [ ] Temporary skipping never writes lasting Taste Profile preferences or creates or changes a Watchlist Entry.
- [ ] Provide immediate Undo and a keyboard-operable way to review and restore titles skipped during the session.
- [ ] Preserve dismissals through same-tab reloads and changes of Viewing Intent.
- [ ] Reuse the existing four-hour sliding inactivity boundary and reject expired dismissals when the session is next used.
- [ ] A genuinely fresh tab session starts without dismissals; verify and document browser session-restoration behavior before promising tab-close deletion.
- [ ] Keep Session Dismissal outside personal-data backups and enduring preference inference.
- [ ] Extend the existing discovery/session boundary only as needed; verify dismissal, recovery, isolation, goal changes, reload, and clock-controlled expiry through public behavior.
- [ ] Inspect readable mobile controls and focus/announcements after dismissal and restoration.

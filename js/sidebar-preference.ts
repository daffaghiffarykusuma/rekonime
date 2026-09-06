// @ts-nocheck
import { CacheManager } from './services/cache-manager.ts';

const SIDEBAR_MODES = ['expanded', 'compact', 'auto-hide'] as const;
type SidebarMode = typeof SIDEBAR_MODES[number];

const SidebarPreference = {
  STORAGE_KEY: 'rekonime.sidebarMode',
  modes: SIDEBAR_MODES,
  currentMode: 'auto-hide' as SidebarMode,
  initialized: false,
  mobileQuery: null as MediaQueryList | null,
  mobileOpen: false,

  getCache() {
    return CacheManager;
  },

  loadMode(): SidebarMode | null {
    try {
      const saved = this.getCache().getRaw(this.STORAGE_KEY, { validate: true });
      return this.modes.includes(saved as SidebarMode) ? saved as SidebarMode : null;
    } catch {
      return null;
    }
  },

  saveMode(mode: SidebarMode) {
    try {
      this.getCache().setRaw(this.STORAGE_KEY, mode, { validate: true });
    } catch {
      // Storage can be unavailable in private browsing.
    }
  },

  applyMode(mode: string) {
    const nextMode = this.modes.includes(mode as SidebarMode) ? mode as SidebarMode : 'auto-hide';
    this.currentMode = nextMode;
    document.documentElement.dataset.sidebarMode = nextMode;
    this.saveMode(nextMode);
    this.updateUI();
  },

  cycleMode() {
    if (this.mobileQuery?.matches) {
      this.setMobileOpen(false, true);
      return;
    }
    this.applyMode(this.currentMode === 'expanded' ? 'compact' : 'expanded');
  },

  setMobileOpen(open: boolean, restoreFocus = false) {
    this.mobileOpen = Boolean(this.mobileQuery?.matches && open);
    const sidebar = document.querySelector<HTMLElement>('.app-sidebar');
    const trigger = document.querySelector<HTMLElement>('.sidebar-edge-trigger');
    document.documentElement.dataset.sidebarOpen = String(this.mobileOpen);
    if (restoreFocus) trigger?.focus();
    if (sidebar) sidebar.inert = Boolean(this.mobileQuery?.matches && !this.mobileOpen);
    if (this.mobileQuery?.matches) trigger?.setAttribute('aria-expanded', String(this.mobileOpen));
    else trigger?.removeAttribute('aria-expanded');
    this.updateUI();
  },

  updateUI() {
    document.querySelectorAll<HTMLElement>('[data-sidebar-option]').forEach((button) => {
      const isActive = button.dataset.sidebarOption === this.currentMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    const toggle = document.querySelector<HTMLElement>('[data-sidebar-action="cycle"]');
    if (toggle) {
      const label = this.mobileQuery?.matches ? 'Close navigation'
        : this.currentMode === 'expanded' ? 'Use compact sidebar' : 'Keep sidebar expanded';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
    }
  },

  renderSelector() {
    const options = [
      { value: 'expanded', label: 'Expanded', description: 'Keep labels visible.', icon: 'ph-sidebar' },
      { value: 'compact', label: 'Compact', description: 'Show an icon rail.', icon: 'ph-sidebar-simple' },
      { value: 'auto-hide', label: 'Auto-hide', description: 'Reveal from the left edge.', icon: 'ph-cursor-click' }
    ];

    return `
      <div class="settings-section settings-section--sidebar">
        <div class="filter-section-title">Sidebar</div>
        <div class="sidebar-mode-selector">
          ${options.map((option) => {
            const isActive = option.value === this.currentMode;
            return `
              <button class="sidebar-mode-option ${isActive ? 'is-active' : ''}" type="button"
                data-action="set-sidebar-mode" data-sidebar-option="${option.value}"
                aria-pressed="${String(isActive)}">
                <i class="ph ${option.icon}" aria-hidden="true"></i>
                <span class="sidebar-mode-copy">
                  <span class="sidebar-mode-label">${option.label}</span>
                  <span class="sidebar-mode-description">${option.description}</span>
                </span>
              </button>`;
          }).join('')}
        </div>
      </div>`;
  },

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this.mobileQuery = window.matchMedia('(max-width: 760px)');
    this.applyMode(this.loadMode() || 'auto-hide');
    this.setMobileOpen(false);
    this.mobileQuery.addEventListener('change', () => this.setMobileOpen(false));
    document.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-sidebar-action="cycle"]')) {
        this.cycleMode();
      } else if (this.mobileQuery?.matches && target?.closest?.('.sidebar-edge-trigger')) {
        this.setMobileOpen(!this.mobileOpen);
      } else if (this.mobileOpen && !target?.closest?.('.app-sidebar')) {
        this.setMobileOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.mobileOpen) this.setMobileOpen(false, true);
    });
  }
};

export { SidebarPreference };

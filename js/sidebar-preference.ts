// @ts-nocheck
import { CacheManager } from './services/cache-manager.ts';

const SIDEBAR_MODES = ['expanded', 'compact', 'auto-hide'] as const;
type SidebarMode = typeof SIDEBAR_MODES[number];

const SidebarPreference = {
  STORAGE_KEY: 'rekonime.sidebarMode',
  modes: SIDEBAR_MODES,
  currentMode: 'auto-hide' as SidebarMode,
  initialized: false,

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
    this.applyMode(this.currentMode === 'expanded' ? 'compact' : 'expanded');
  },

  updateUI() {
    document.querySelectorAll<HTMLElement>('[data-sidebar-option]').forEach((button) => {
      const isActive = button.dataset.sidebarOption === this.currentMode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    const toggle = document.querySelector<HTMLElement>('[data-sidebar-action="cycle"]');
    if (toggle) {
      const label = this.currentMode === 'expanded' ? 'Use compact sidebar' : 'Keep sidebar expanded';
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
    this.applyMode(this.loadMode() || 'auto-hide');
    document.addEventListener('click', (event) => {
      const target = (event.target as Element | null)?.closest?.('[data-sidebar-action="cycle"]');
      if (target) this.cycleMode();
    });
  }
};

export { SidebarPreference };

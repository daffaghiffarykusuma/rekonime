// @ts-nocheck
import { ThemeManager } from './themeManager.js';
import { SidebarPreference } from './sidebar-preference.ts';
import { Logger } from './services/logger.ts';
import { initDeferredRuntimeServices } from './bootstrap/deferred-runtime.js';

let appPromise = null;

const getConnectionInfo = () => {
  if (typeof navigator === 'undefined') return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
};

const shouldPrioritizeFirstPaint = () => {
  if (typeof window === 'undefined') return false;
  const connection = getConnectionInfo();
  const effectiveType = String(connection?.effectiveType || '').toLowerCase();
  const constrainedConnection = Boolean(connection?.saveData) || effectiveType.includes('2g') || effectiveType.includes('3g') || effectiveType === 'slow-4g';
  const mobileViewport = window.matchMedia?.('(max-width: 640px)').matches ?? false;
  const lowMemory = Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4;
  return constrainedConnection || mobileViewport || lowMemory;
};

const loadApp = () => {
  if (!appPromise) {
    appPromise = import('./app.ts').then((module) => module.App || module.default);
  }
  return appPromise;
};

const initNonCriticalServices = (app) => {
  initDeferredRuntimeServices({
    timeoutMs: 7000,
    loadModules: async () => Promise.all([
        import('./keyboardShortcuts.ts'),
        import('./serviceWorker.ts'),
        import('./recommendations.ts')
      ]),
    onReady: async ([keyboardModule, swModule, recsModule]) => {
      const { KeyboardShortcuts } = keyboardModule;
      const { ServiceWorkerManager } = swModule;
      const { Recommendations } = recsModule;

      Recommendations.loadModePreference();
      KeyboardShortcuts.configure({
        commands: {
          closeModal: () => app?.handleGlobalEscape?.({ key: 'Escape' }),
          openFilters: () => app?.toggleFilterPanel?.(),
          toggleSettings: () => app?.toggleSettingsModal?.(),
          surpriseMe: () => app?.showSurpriseMe?.(),
          goHome: () => app?.clearAllFilters?.(),
          openAnime: (animeId) => app?.showAnimeDetail?.(animeId)
        },
        getNavigationState: () => ({
          currentAnimeId: app?.currentAnimeId || '',
          animeIds: Array.isArray(app?.animeData) ? app.animeData.map(anime => anime?.id).filter(Boolean) : []
        })
      });
      KeyboardShortcuts.init();
      ServiceWorkerManager.register();
      ServiceWorkerManager.initConnectivityListeners();
    },
    onError: (error) => {
      Logger?.warn?.('Deferred services failed to init', { error });
    }
  });
};

const bootstrap = () => {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    performance.mark('rekonime:bootstrap-start');
  }
  Logger.init({ level: 'info', captureGlobalErrors: true });
  ThemeManager.init();
  SidebarPreference.init();

  const runApp = async () => {
    try {
      const app = await loadApp();
      await app.init();
      initNonCriticalServices(app);
    } catch (error) {
      Logger?.error?.('Failed to boot app', { error });
    }
  };

  const scheduleAppBoot = () => {
    if (typeof window === 'undefined') {
      void runApp();
      return;
    }

    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark('rekonime:app-boot-scheduled');
    }

    if (shouldPrioritizeFirstPaint()) {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          void runApp();
        }, { timeout: 1500 });
      } else {
        window.setTimeout(() => {
          void runApp();
        }, 350);
      }
      return;
    }

    void runApp();
  };

  scheduleAppBoot();
};

if (typeof document !== 'undefined') {
  bootstrap();
}

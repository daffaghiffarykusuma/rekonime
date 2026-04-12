import { ThemeManager } from './themeManager.js';
import { Logger } from './services/logger.js';
import { initDeferredRuntimeServices } from './bootstrap/deferred-runtime.js';
import './bootstrap/noncritical-styles.js';

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
    appPromise = import('./app.js').then((module) => module.App || module.default);
  }
  return appPromise;
};

const initNonCriticalServices = () => {
  initDeferredRuntimeServices({
    timeoutMs: 7000,
    loadModules: async () => Promise.all([
        loadApp(),
        import('./keyboardShortcuts.js'),
        import('./serviceWorker.js'),
        import('./services/analytics-service.js'),
        import('./performanceMonitor.js'),
        import('./recommendations.js')
      ]),
    onReady: async ([app, keyboardModule, swModule, analyticsModule, perfModule, recsModule]) => {
      const { KeyboardShortcuts } = keyboardModule;
      const { ServiceWorkerManager } = swModule;
      const { AnalyticsService } = analyticsModule;
      const { PerformanceMonitor } = perfModule;
      const { Recommendations } = recsModule;

      AnalyticsService.init();
      PerformanceMonitor.init();
      Recommendations.loadModePreference();
      KeyboardShortcuts.setApp(app);
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
  Logger.init({ level: 'info', captureGlobalErrors: true });
  ThemeManager.init();

  const runApp = async () => {
    try {
      const app = await loadApp();
      await app.init();
    } catch (error) {
      Logger?.error?.('Failed to boot app', { error });
    }
  };

  const scheduleAppBoot = () => {
    if (typeof window === 'undefined') {
      void runApp();
      return;
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

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        void runApp();
      });
      return;
    }

    window.setTimeout(() => {
      void runApp();
    }, 0);
  };

  scheduleAppBoot();

  initNonCriticalServices();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

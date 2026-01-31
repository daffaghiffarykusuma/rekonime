import { App } from './app.js';
import { ThemeManager } from './themeManager.js';
import { Recommendations } from './recommendations.js';
import { KeyboardShortcuts } from './keyboardShortcuts.js';
import { ServiceWorkerManager } from './serviceWorker.js';

const bootstrap = () => {
  ThemeManager.init();
  Recommendations.loadModePreference();
  KeyboardShortcuts.setApp(App);
  KeyboardShortcuts.init();
  const runApp = () => App.init();
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(runApp);
  } else {
    setTimeout(runApp, 0);
  }
  ServiceWorkerManager.register();
  ServiceWorkerManager.initConnectivityListeners();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

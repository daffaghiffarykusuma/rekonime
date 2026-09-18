// @ts-nocheck
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

const Logger = {
  enabled: true,
  currentLevel: LEVELS.info,
  initialized: false,
  globalHandlersInstalled: false,

  init({ level = 'info', captureGlobalErrors = true } = {}) {
    if (this.initialized) return;
    this.initialized = true;
    this.setLevel(level);
    if (captureGlobalErrors) this.installGlobalHandlers();
  },

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  },

  setLevel(level) {
    const resolved = typeof level === 'string' ? LEVELS[level.trim().toLowerCase()] : level;
    if (Number.isFinite(resolved)) this.currentLevel = resolved;
  },

  debug(message, context) { this.log('debug', message, context); },
  info(message, context) { this.log('info', message, context); },
  warn(message, context) { this.log('warn', message, context); },
  error(message, context) { this.log('error', message, context); },
  fatal(message, context) { this.log('fatal', message, context); },

  log(level, message, context) {
    if (!this.enabled || LEVELS[level] < this.currentLevel || typeof console === 'undefined') return;
    const write = console[level === 'fatal' ? 'error' : level] || console.log;
    if (context === undefined) write.call(console, `[Rekonime] ${String(message ?? '')}`);
    else write.call(console, `[Rekonime] ${String(message ?? '')}`, context);
  },

  installGlobalHandlers() {
    if (this.globalHandlersInstalled || typeof window === 'undefined') return;
    this.globalHandlersInstalled = true;
    window.addEventListener('error', event => {
      this.error('Unhandled error', { error: event?.error, message: event?.message });
    });
    window.addEventListener('unhandledrejection', event => {
      this.error('Unhandled promise rejection', { reason: event?.reason });
    });
  }
};

export { Logger };

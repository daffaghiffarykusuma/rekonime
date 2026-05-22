/**
 * Service Worker Registration Module
 * Handles SW registration, updates, and offline indicators
 */

import { Logger } from './services/logger.js';
import { setHTML, toTrustedScriptURL } from './security/trusted-types.js';

const ServiceWorkerManager = {
    registration: null,
    updateAvailable: false,
    updatePromptVisible: false,
    updateReloadKey: 'rekonime.sw.pending-reload',
    isLocalhost() {
        if (typeof window === 'undefined') return false;
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    },

    shouldReloadForActivatedUpdate() {
        if (typeof window === 'undefined') return false;
        try {
            return window.sessionStorage.getItem(this.updateReloadKey) === '1';
        } catch (error) {
            return false;
        }
    },

    markPendingReload() {
        if (typeof window === 'undefined') return;
        try {
            window.sessionStorage.setItem(this.updateReloadKey, '1');
        } catch (error) {
            // Ignore storage failures and fall back to the current in-memory shell.
        }
    },

    clearPendingReload() {
        if (typeof window === 'undefined') return;
        try {
            window.sessionStorage.removeItem(this.updateReloadKey);
        } catch (error) {
            // Ignore storage failures.
        }
    },

    /**
     * Register the service worker
     */
    async register() {
        if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
            Logger?.info ? Logger.info('[SW] Skipping registration on file protocol') : console.log('[SW] Skipping registration on file protocol');
            return false;
        }
        if (this.isLocalhost()) {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                registrations.forEach(registration => registration.unregister());
            }
            Logger?.info ? Logger.info('[SW] Skipping registration on localhost') : console.log('[SW] Skipping registration on localhost');
            return false;
        }
        if (!('serviceWorker' in navigator)) {
            Logger?.info ? Logger.info('[SW] Service Worker not supported') : console.log('[SW] Service Worker not supported');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register(toTrustedScriptURL('/sw.js'), { type: 'module' });
            this.registration = registration;

            Logger?.info ? Logger.info('[SW] Registered successfully', { scope: registration.scope }) : console.log('[SW] Registered successfully:', registration.scope);
            registration.update?.().catch(() => {});

            // Handle updates
            this.handleUpdates(registration);

            // Check for existing waiting worker
            if (registration.waiting) {
                this.showUpdatePrompt();
            }

            // Listen for controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                Logger?.info ? Logger.info('[SW] New controller activated') : console.log('[SW] New controller activated');
                this.updateAvailable = true;
                if (this.shouldReloadForActivatedUpdate()) {
                    this.clearPendingReload();
                    window.location.reload();
                    return;
                }
                this.showUpdatePrompt();
            });

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'CACHE_UPDATED') {
                    Logger?.info ? Logger.info('[SW] Cache updated', { url: event.data.url }) : console.log('[SW] Cache updated:', event.data.url);
                }
            });

            return true;
        } catch (error) {
            Logger?.error ? Logger.error('[SW] Registration failed', { error }) : console.error('[SW] Registration failed:', error);
            return false;
        }
    },

    /**
     * Handle service worker updates
     */
    handleUpdates(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            Logger?.info ? Logger.info('[SW] Update found, installing...') : console.log('[SW] Update found, installing...');

            newWorker.addEventListener('statechange', () => {
                Logger?.info ? Logger.info('[SW] Worker state', { state: newWorker.state }) : console.log('[SW] Worker state:', newWorker.state);

                if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // New update available
                        Logger?.info ? Logger.info('[SW] New version available') : console.log('[SW] New version available');
                        this.updateAvailable = true;
                        this.showUpdatePrompt();
                    } else {
                        // First install
                        Logger?.info ? Logger.info('[SW] First install complete') : console.log('[SW] First install complete');
                    }
                }
            });
        });
    },

    /**
     * Show update available prompt
     */
    showUpdatePrompt() {
        let updateBanner = document.getElementById('sw-update-banner');
        if (!updateBanner) {
            updateBanner = document.createElement('div');
            updateBanner.id = 'sw-update-banner';
            updateBanner.className = 'sw-update-banner';
            setHTML(updateBanner, `
      <span class="sw-update-message">A newer version of Rekonime is ready.</span>
      <button class="sw-update-btn" id="sw-update-btn">Refresh now</button>
      <button class="sw-update-dismiss" id="sw-dismiss-btn">Dismiss</button>
    `);
            document.body.appendChild(updateBanner);
        }

        const applyButton = updateBanner.querySelector('#sw-update-btn');
        const dismissButton = updateBanner.querySelector('#sw-dismiss-btn');
        if (applyButton) {
            applyButton.onclick = () => {
                this.applyUpdate();
                this.dismissUpdatePrompt();
            };
        }
        if (dismissButton) {
            dismissButton.onclick = () => {
                this.dismissUpdatePrompt();
            };
        }
        this.updatePromptVisible = true;
    },

    dismissUpdatePrompt() {
        const updateBanner = document.getElementById('sw-update-banner');
        if (updateBanner) {
            updateBanner.remove();
        }
        this.updatePromptVisible = false;
    },

    /**
     * Apply the service worker update
     */
    applyUpdate() {
        if (!this.registration || !this.registration.waiting) {
            return;
        }

        // Tell the waiting SW to skip waiting
        this.markPendingReload();
        this.registration.waiting.postMessage('skipWaiting');
        this.dismissUpdatePrompt();
    },

    /**
     * Check if the app is offline
     */
    isOffline() {
        return !navigator.onLine;
    },

    /**
     * Show offline indicator
     */
    showOfflineIndicator() {
        let indicator = document.getElementById('offline-indicator');

        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'offline-indicator';
            indicator.className = 'offline-indicator';
            indicator.setAttribute('hidden', '');
            setHTML(indicator, "<span class=\"offline-icon\" aria-hidden=\"true\">!</span><div class=\"offline-content\"><span class=\"offline-title\">You are offline</span><span class=\"offline-features\">Using saved data where available.</span></div>");
            document.body.appendChild(indicator);
        }

        indicator.classList.add('visible');
        indicator.removeAttribute('hidden');
        this.setOfflineState(true);
        this.updateOfflineIndicator(indicator);
    },

    /**
     * Hide offline indicator
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
            indicator.setAttribute('hidden', '');
        }
        this.setOfflineState(false);
    },

    setOfflineState(isOffline) {
        const root = document.documentElement;
        if (!root) return;
        if (isOffline) {
            root.setAttribute('data-offline', 'true');
        } else {
            root.removeAttribute('data-offline');
        }
    },

    async getOfflineCapabilities() {
        const root = document.documentElement;
        const catalogStatus = root?.dataset?.catalogStatus;
        const hasLoadedData = catalogStatus === 'embedded' || catalogStatus === 'full';
        let hasCachedData = false;

        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                const dataCacheName = cacheNames.find(name => name.startsWith('rekonime-data-'));
                if (dataCacheName) {
                    const cache = await caches.open(dataCacheName);
                    const candidates = [
                        './data/anime.full.index.json',
                        'data/anime.full.index.json',
                        '/data/anime.full.index.json'
                    ];
                    for (const candidate of candidates) {
                        const match = await cache.match(candidate);
                        if (match) {
                            hasCachedData = true;
                            break;
                        }
                    }
                }
            } catch (error) {
                hasCachedData = false;
            }
        }

        const canBrowse = hasLoadedData || hasCachedData;
        return {
            canBrowse,
            canSearch: canBrowse,
            canDetails: canBrowse,
            canReviews: false
        };
    },

    formatOfflineFeatures(capabilities) {
        const yes = '&#10003;';
        const no = '&#10007;';
        const render = (label, ok) => `
      <span class="offline-feature ${ok ? 'is-available' : 'is-unavailable'}">
        ${label} ${ok ? yes : no}
      </span>
    `;
        return [
            render('Browse', capabilities.canBrowse),
            render('Search', capabilities.canSearch),
            render('Details', capabilities.canDetails),
            render('Reviews', capabilities.canReviews)
        ].join('');
    },

    async updateOfflineIndicator(indicator) {
        const target = indicator || document.getElementById('offline-indicator');
        if (!target) return;
        const capabilities = await this.getOfflineCapabilities();
        const features = this.formatOfflineFeatures(capabilities);
        setHTML(target, `
      <span class="offline-icon" aria-hidden="true">!</span>
      <div class="offline-content">
        <span class="offline-title">You are offline</span>
        <span class="offline-features">${features}</span>
      </div>
    `);
    },

    /**
     * Initialize offline/online listeners
     */
    initConnectivityListeners() {
        window.addEventListener('online', () => {
            Logger?.info ? Logger.info('[SW] App is online') : console.log('[SW] App is online');
            this.hideOfflineIndicator();
        });

        window.addEventListener('offline', () => {
            Logger?.warn ? Logger.warn('[SW] App is offline') : console.log('[SW] App is offline');
            this.showOfflineIndicator();
        });

        // Check initial state
        if (this.isOffline()) {
            this.showOfflineIndicator();
        }
    }
};

export { ServiceWorkerManager };
export default ServiceWorkerManager;


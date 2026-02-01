/**
 * Service Worker Registration Module
 * Handles SW registration, updates, and offline indicators
 */

import { Logger } from './services/logger.js';

const ServiceWorkerManager = {
    registration: null,
    updateAvailable: false,
    isLocalhost() {
        if (typeof window === 'undefined') return false;
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    },

    /**
     * Register the service worker
     */
    async register() {
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
            const registration = await navigator.serviceWorker.register('./sw.js');
            this.registration = registration;

            Logger?.info ? Logger.info('[SW] Registered successfully', { scope: registration.scope }) : console.log('[SW] Registered successfully:', registration.scope);

            // Handle updates
            this.handleUpdates(registration);

            // Check for existing waiting worker
            if (registration.waiting) {
                this.showUpdatePrompt();
            }

            // Listen for controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                Logger?.info ? Logger.info('[SW] New controller activated') : console.log('[SW] New controller activated');
                window.location.reload();
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
        // Create update notification
        const updateBanner = document.createElement('div');
        updateBanner.id = 'sw-update-banner';
        updateBanner.className = 'sw-update-banner';
        updateBanner.innerHTML = `
      <span class="sw-update-message">🔄 Update available!</span>
      <button class="sw-update-btn" id="sw-update-btn">Update Now</button>
      <button class="sw-update-dismiss" id="sw-dismiss-btn">Later</button>
    `;

        document.body.appendChild(updateBanner);

        // Add event listeners
        document.getElementById('sw-update-btn').addEventListener('click', () => {
            this.applyUpdate();
            updateBanner.remove();
        });

        document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
            updateBanner.remove();
        });
    },

    /**
     * Apply the service worker update
     */
    applyUpdate() {
        if (!this.registration || !this.registration.waiting) {
            return;
        }

        // Tell the waiting SW to skip waiting
        this.registration.waiting.postMessage('skipWaiting');
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
            indicator.innerHTML = "<span class=\"offline-icon\" aria-hidden=\"true\">!</span><div class=\"offline-content\"><span class=\"offline-title\">You're offline</span><span class=\"offline-features\">Checking offline features...</span></div>";
            document.body.appendChild(indicator);
        }

        indicator.classList.add('visible');
        indicator.setAttribute('aria-hidden', 'false');
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
            indicator.setAttribute('aria-hidden', 'true');
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
        const hasLoadedData = catalogStatus === 'preview' || catalogStatus === 'full';
        let hasCachedData = false;

        if ('caches' in window) {
            try {
                const cacheNames = await caches.keys();
                const dataCacheName = cacheNames.find(name => name.startsWith('rekonime-data-'));
                if (dataCacheName) {
                    const cache = await caches.open(dataCacheName);
                    const candidates = [
                        './data/anime.full.json',
                        'data/anime.full.json',
                        '/data/anime.full.json',
                        './data/anime.preview.json',
                        'data/anime.preview.json',
                        '/data/anime.preview.json'
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
        target.innerHTML = `
      <span class="offline-icon" aria-hidden="true">!</span>
      <div class="offline-content">
        <span class="offline-title">You're offline</span>
        <span class="offline-features">${features}</span>
      </div>
    `;
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


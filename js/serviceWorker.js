/**
 * Service Worker Registration Module
 * Handles SW registration, updates, and offline indicators
 */

const ServiceWorkerManager = {
    registration: null,
    updateAvailable: false,

    /**
     * Register the service worker
     */
    async register() {
        if (!('serviceWorker' in navigator)) {
            console.log('[SW] Service Worker not supported');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            this.registration = registration;

            console.log('[SW] Registered successfully:', registration.scope);

            // Handle updates
            this.handleUpdates(registration);

            // Check for existing waiting worker
            if (registration.waiting) {
                this.showUpdatePrompt();
            }

            // Listen for controller change (new SW activated)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[SW] New controller activated');
                window.location.reload();
            });

            // Listen for messages from SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'CACHE_UPDATED') {
                    console.log('[SW] Cache updated:', event.data.url);
                }
            });

            return true;
        } catch (error) {
            console.error('[SW] Registration failed:', error);
            return false;
        }
    },

    /**
     * Handle service worker updates
     */
    handleUpdates(registration) {
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[SW] Update found, installing...');

            newWorker.addEventListener('statechange', () => {
                console.log('[SW] Worker state:', newWorker.state);

                if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // New update available
                        console.log('[SW] New version available');
                        this.updateAvailable = true;
                        this.showUpdatePrompt();
                    } else {
                        // First install
                        console.log('[SW] First install complete');
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
            indicator.innerHTML = '📡 Offline Mode - Using cached data';
            document.body.appendChild(indicator);
        }

        indicator.classList.add('visible');
    },

    /**
     * Hide offline indicator
     */
    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.classList.remove('visible');
        }
    },

    /**
     * Initialize offline/online listeners
     */
    initConnectivityListeners() {
        window.addEventListener('online', () => {
            console.log('[SW] App is online');
            this.hideOfflineIndicator();
        });

        window.addEventListener('offline', () => {
            console.log('[SW] App is offline');
            this.showOfflineIndicator();
        });

        // Check initial state
        if (this.isOffline()) {
            this.showOfflineIndicator();
        }
    }
};

// Auto-register when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            ServiceWorkerManager.register();
            ServiceWorkerManager.initConnectivityListeners();
        });
    } else {
        ServiceWorkerManager.register();
        ServiceWorkerManager.initConnectivityListeners();
    }
}

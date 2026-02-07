/**
 * Service Worker for Rekonime
 * Provides offline caching and data persistence
 */
import { buildNormalizedDataRequest } from './js/sw-cache-policy.js';

const CACHE_VERSION = 'v1770428804576-a36756b';
const STATIC_CACHE = `rekonime-static-${CACHE_VERSION}`;
const DATA_CACHE = `rekonime-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `rekonime-images-${CACHE_VERSION}`;
const IS_LOCALHOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './watchlist.html',
    './css/styles.css',
    './css/themes.css',
    './css/watchlist.css',
    './js/main.js',
    './js/watchlist.js',
    './js/watchlist-main.js',
    './js/data.js',
    './favicon.svg'
];

const precacheStaticAssets = async (cache) => {
    const results = await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${asset}: ${response.status}`);
            }
            await cache.put(request, response);
        })
    );

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) {
        console.warn(`[SW] Precache skipped ${failed.length} asset(s)`);
    }
};

// Install: Cache static assets
self.addEventListener('install', (event) => {
    if (IS_LOCALHOST) {
        self.skipWaiting();
        return;
    }
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('[SW] Caching static assets');
                return precacheStaticAssets(cache);
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    if (IS_LOCALHOST) {
        event.waitUntil(self.registration.unregister().then(() => self.clients.claim()));
        return;
    }
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            return name.startsWith('rekonime-') &&
                                !name.includes(CACHE_VERSION);
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Fetch: Handle requests with appropriate strategies
self.addEventListener('fetch', (event) => {
    if (IS_LOCALHOST) {
        return;
    }
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external image CDNs (MAL, etc.) - let browser handle directly
    if (url.hostname.includes('cdn.myanimelist.net') ||
        url.hostname.includes('myanimelist.cdn-dena.com')) {
        return;
    }

    // Explicit same-origin JSON data endpoints only.
    const normalizedDataRequest = buildNormalizedDataRequest(request, self.location.origin);
    if (normalizedDataRequest) {
        event.respondWith(cacheFirstWithBackgroundUpdate(normalizedDataRequest));
        return;
    }

    // Images - Stale While Revalidate (only for same-origin images)
    if (isImageRequest(request)) {
        event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
        return;
    }

    // Static assets - Cache First
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // API requests (Jikan) - Network First with cache fallback
    if (url.hostname.includes('api.jikan.moe')) {
        event.respondWith(networkFirstWithCacheFallback(request));
        return;
    }

    // Default: Network with cache fallback
    event.respondWith(networkWithCacheFallback(request));
});

// Helper: Check if request is for an image
function isImageRequest(request) {
    const dest = request.destination;
    return dest === 'image' ||
        request.url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
}

// Helper: Check if request is for static assets
function isStaticAsset(request) {
    const dest = request.destination;
    return dest === 'script' ||
        dest === 'style' ||
        dest === 'document' ||
        dest === 'font';
}

// Strategy: Cache First
async function cacheFirst(request, cacheName = STATIC_CACHE) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        // Return a fallback if available
        return new Response('Offline', { status: 503 });
    }
}

// Strategy: Cache First with Background Update
async function cacheFirstWithBackgroundUpdate(request) {
    const cache = await caches.open(DATA_CACHE);
    const cached = await cache.match(request);

    // Always try to fetch fresh data in background
    const fetchPromise = fetch(request)
        .then(async (response) => {
            if (response.ok) {
                // Update cache with fresh data
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch((error) => {
            console.log('[SW] Background fetch failed:', error);
            // Return cached if available, otherwise rethrow
            if (cached) {
                return cached;
            }
            throw error;
        });

    // Return cached immediately if available
    if (cached) {
        // Return cached but also trigger background update
        fetchPromise.catch(() => { }); // Ignore errors for background fetch
        return cached;
    }

    // No cache - wait for fetch
    return fetchPromise;
}

// Strategy: Stale While Revalidate
async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    // Always fetch fresh
    const fetchPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch((error) => {
            console.log('[SW] Image fetch failed:', error);
            if (cached) {
                return cached;
            }
            throw error;
        });

    // Return cached immediately if available
    if (cached) {
        fetchPromise.catch(() => { }); // Ignore errors for background fetch
        return cached;
    }

    // No cache - wait for fetch
    return fetchPromise;
}

// Strategy: Network First with Cache Fallback
async function networkFirstWithCacheFallback(request) {
    const cache = await caches.open(DATA_CACHE);

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
        }
        throw new Error('Network response not ok');
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', error);
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

// Strategy: Network with Cache Fallback
async function networkWithCacheFallback(request) {
    try {
        return await fetch(request);
    } catch (error) {
        console.log('[SW] Network failed, trying cache:', error);
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});

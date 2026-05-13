/**
 * Service Worker for Rekonime
 * Provides offline caching and data persistence
 */
import { buildNormalizedDataRequest, getAppShellFallbackPath, hostMatchesAllowlist } from './js/sw-cache-policy.js';

const CACHE_VERSION = '__REKONIME_CACHE_VERSION__';
const STATIC_CACHE = `rekonime-static-${CACHE_VERSION}`;
const DATA_CACHE = `rekonime-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `rekonime-images-${CACHE_VERSION}`;
const IS_LOCALHOST = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
const MAL_CDN_HOSTS = ['cdn.myanimelist.net', 'myanimelist.cdn-dena.com'];
const API_HOSTS = ['api.jikan.moe'];

const STATIC_ASSETS = [
    '/index.html',
    '/watchlist.html',
    '/css/styles.css',
    '/css/themes.css',
    '/css/watchlist.css',
    '/js/main.js',
    '/js/watchlist-main.js',
    '/js/data.js',
    '/favicon.svg'
];

const LEGACY_HOME_PATHS = new Set(['/home', '/home/']);

const LEGACY_DOCUMENT_CACHE_KEYS = [
    './',
    './index.html',
    './watchlist.html',
    '/home',
    '/home/',
    `${self.location.origin}/home`,
    `${self.location.origin}/home/`
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
        throw new Error(`Failed to precache ${failed.length} asset(s)`);
    }
};

const cleanupLegacyDocumentAliases = async (cache) => {
    const legacyKeys = [
        ...LEGACY_DOCUMENT_CACHE_KEYS,
        self.location.origin,
        `${self.location.origin}/`
    ];

    await Promise.all(legacyKeys.map((key) => cache.delete(key)));
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
                throw error;
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
            .then(async () => {
                const cache = await caches.open(STATIC_CACHE);
                await cleanupLegacyDocumentAliases(cache);
                await self.clients.claim();
            })
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
    if (hostMatchesAllowlist(url.hostname, MAL_CDN_HOSTS)) {
        return;
    }

    // Explicit same-origin JSON data endpoints only.
    const normalizedDataRequest = buildNormalizedDataRequest(request, self.location.origin);
    if (normalizedDataRequest) {
        const { response, background } = cacheFirstWithBackgroundUpdate(normalizedDataRequest);
        event.respondWith(response);
        event.waitUntil(background);
        return;
    }

    // Navigation documents should prefer the network so app copy and shell updates stay fresh.
    if (isDocumentRequest(request, url)) {
        event.respondWith(networkFirstDocument(request, url));
        return;
    }

    // Images - Stale While Revalidate (only for same-origin images)
    if (isImageRequest(request)) {
        const { response, background } = staleWhileRevalidate(request, IMAGE_CACHE);
        event.respondWith(response);
        event.waitUntil(background);
        return;
    }

    // Static assets - Cache First
    if (isStaticAsset(request)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // API requests (Jikan) - Network First with cache fallback
    if (hostMatchesAllowlist(url.hostname, API_HOSTS)) {
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

function isDocumentRequest(request, url) {
    if (!request || !url) {
        return false;
    }
    if (url.origin !== self.location.origin) {
        return false;
    }
    return request.mode === 'navigate' || request.destination === 'document';
}

// Helper: Check if request is for static assets
function isStaticAsset(request) {
    const dest = request.destination;
    return dest === 'script' ||
        dest === 'style' ||
        dest === 'font';
}

async function getCachedDocumentResponse(cache, requestUrl) {
    const fallbackPath = getAppShellFallbackPath(requestUrl.pathname);
    if (fallbackPath) {
        const fallbackUrl = new URL(fallbackPath, self.location.origin);
        const candidateUrls = [
            fallbackUrl.toString(),
            fallbackPath
        ];
        for (const candidate of candidateUrls) {
            const cached = await cache.match(candidate);
            if (cached) {
                return cached;
            }
        }
        return null;
    }

    return cache.match(requestUrl.toString());
}

async function networkFirstDocument(request, url) {
    const cache = await caches.open(STATIC_CACHE);
    const requestUrl = url instanceof URL ? url : new URL(request.url);
    const normalizedRequest = LEGACY_HOME_PATHS.has(requestUrl.pathname)
        ? new Request(new URL('/', self.location.origin).toString(), { cache: 'no-store' })
        : new Request(request, { cache: 'no-store' });

    try {
        const networkResponse = await fetch(normalizedRequest);
        if (networkResponse.ok) {
            const fallbackPath = getAppShellFallbackPath(requestUrl.pathname);
            if (fallbackPath) {
                const fallbackUrl = new URL(fallbackPath, self.location.origin);
                await cache.put(fallbackUrl.toString(), networkResponse.clone());
            } else {
                await cache.put(requestUrl.toString(), networkResponse.clone());
            }
        }
        return networkResponse;
    } catch (error) {
        console.log('[SW] Document fetch failed, trying cache:', error);
        const cached = await getCachedDocumentResponse(cache, requestUrl);
        if (cached) {
            return cached;
        }
        return new Response('Offline', { status: 503 });
    }
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
function cacheFirstWithBackgroundUpdate(request) {
    const cachePromise = caches.open(DATA_CACHE);
    const background = cachePromise
        .then(async (cache) => {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch((error) => {
            console.log('[SW] Background fetch failed:', error);
            throw error;
        });

    const response = cachePromise
        .then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }
            return background;
        });

    return {
        response,
        background: background.then(() => undefined).catch(() => undefined)
    };
}

// Strategy: Stale While Revalidate
function staleWhileRevalidate(request, cacheName) {
    const cachePromise = caches.open(cacheName);
    const background = cachePromise
        .then(async (cache) => {
            const response = await fetch(request);
            if (response.ok) {
                await cache.put(request, response.clone());
            }
            return response;
        })
        .catch((error) => {
            console.log('[SW] Image fetch failed:', error);
            throw error;
        });

    const response = cachePromise
        .then(async (cache) => {
            const cached = await cache.match(request);
            if (cached) {
                return cached;
            }
            return background;
        });

    return {
        response,
        background: background.then(() => undefined).catch(() => undefined)
    };
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

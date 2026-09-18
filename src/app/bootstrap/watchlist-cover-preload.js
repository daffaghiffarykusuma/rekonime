(function preloadWatchlistCover() {
  try {
    const raw = localStorage.getItem('rekonime.watchlist');
    if (!raw) return;

    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return;

    const entries = Array.isArray(data) ? data : data.entries;
    if (!Array.isArray(entries) || entries.length === 0) return;

    const entryWithCover = entries.find((entry) => {
      return entry && entry.snapshot && typeof entry.snapshot.cover === 'string' && entry.snapshot.cover.trim();
    }) || entries[0];

    const cover = entryWithCover && entryWithCover.snapshot && entryWithCover.snapshot.cover;
    if (!cover || typeof cover !== 'string') return;

    let trimmed = cover.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('//')) {
      trimmed = `https:${trimmed}`;
    }
    if (!/^https?:\/\//i.test(trimmed)) return;

    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return;

    const host = parsed.hostname.toLowerCase();
    const allowedHosts = [
      'cdn.myanimelist.net',
      'myanimelist.cdn-dena.com',
      'images.weserv.nl',
      'via.placeholder.com'
    ];
    const isAllowed = allowedHosts.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
    if (!isAllowed) return;

    let proxyStatus = null;
    try {
      const proxyRaw = localStorage.getItem('rekonime.imageProxyStatus');
      if (proxyRaw) {
        const proxyParsed = JSON.parse(proxyRaw);
        const checkedAt = Number(proxyParsed && proxyParsed.checkedAt) || 0;
        const ttlMs = 6 * 60 * 60 * 1000;
        if (checkedAt && Date.now() - checkedAt <= ttlMs) {
          proxyStatus = proxyParsed && proxyParsed.ok === true
            ? true
            : (proxyParsed && proxyParsed.ok === false ? false : null);
        }
      }
    } catch {
      proxyStatus = null;
    }

    let linkUrl = trimmed;
    if (host !== 'images.weserv.nl' && proxyStatus === true) {
      const normalized = trimmed.replace(/^https?:\/\//i, '').replace(/^\/\//, '');
      linkUrl = `https://images.weserv.nl/?url=${encodeURIComponent(normalized)}&w=240&h=360&fit=cover&output=webp`;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = linkUrl;
    link.setAttribute('fetchpriority', 'high');
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    // Ignore preload errors
  }
}());

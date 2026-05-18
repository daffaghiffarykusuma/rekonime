import { test, expect } from '@playwright/test';

const ignoredConsoleErrorPatterns = [
  /favicon/i
];

const installFailureCollectors = (page) => {
  const failures = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) return;
    failures.push(`console error: ${text}`);
  });

  page.on('pageerror', (error) => {
    failures.push(`page error: ${error.message}`);
  });

  return failures;
};

const getVisibleCatalogSnapshot = async (page) => page.locator('#anime-grid .anime-card').evaluateAll((cards) => {
  return cards.slice(0, 12).map((card) => {
    const rect = card.getBoundingClientRect();
    return {
      id: card.dataset.animeId || '',
      title: card.querySelector('.anime-title')?.textContent?.trim() || '',
      meta: card.querySelector('.anime-meta')?.textContent?.replace(/\s+/g, ' ').trim() || '',
      stats: [...card.querySelectorAll('.stat-value, .card-stat-value')]
        .map((node) => node.textContent?.trim() || '')
        .join('|'),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  });
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.tourStep', '0');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
});

test('production build supports browse, full catalog, search, details, and watchlist', async ({ page }) => {
  const failures = installFailureCollectors(page);
  const catalogRequests = [];

  await page.route('https://api.jikan.moe/**', (route) => {
    const isReviewsRequest = route.request().url().includes('/reviews');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isReviewsRequest
        ? { data: [], pagination: { has_next_page: false } }
        : { data: { synopsis: 'Production smoke synopsis.' } })
    });
  });
  await page.route('https://graphql.anilist.co/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        Page: {
          media: []
        }
      }
    })
  }));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== new URL(page.url() || 'http://127.0.0.1:4174').origin) return;
    if (url.pathname.startsWith('/data/')) {
      catalogRequests.push(url.pathname);
    }
  });

  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.waitForSelector('#anime-grid .anime-card');
  await expect(page.locator('#anime-grid .anime-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-catalog-status', 'preview');
  const previewSnapshot = await getVisibleCatalogSnapshot(page);
  expect(previewSnapshot.length).toBeGreaterThan(0);

  await page.dispatchEvent('body', 'pointerdown');
  await page.waitForFunction(() => document.documentElement.dataset.catalogStatus === 'full', null, { timeout: 45000 });
  const fullSnapshot = await getVisibleCatalogSnapshot(page);
  expect(fullSnapshot).toEqual(previewSnapshot);
  expect(catalogRequests).toContain('/data/anime.preview.json');
  expect(catalogRequests).toContain('/data/anime.full.index.json');
  expect(catalogRequests).not.toContain('/data/anime.full.json');

  const searchInput = page.locator('#header-search');
  await searchInput.click();
  await searchInput.pressSequentially('Doraemon');
  await expect(searchInput).toHaveValue('Doraemon');
  await page.waitForSelector('#header-search-dropdown.visible');
  await expect(page.locator('#header-search-dropdown [data-action="open-anime"]').first()).toBeVisible();

  await page.locator('#anime-grid .anime-card').first().click();
  await page.waitForSelector('#detail-modal.visible');
  await expect(page.locator('#detail-modal.visible')).toBeVisible();
  await expect.poll(() => catalogRequests.some((path) => path.startsWith('/data/anime.detail/'))).toBe(true);
  await expect(page.locator('#detail-modal.visible')).toContainText(/Episodes|Franchise|Finish Rate/i);
  await page.waitForSelector('#watchlist-select');
  await page.selectOption('#watchlist-select', 'planned');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  await expect(page.locator('#watchlist-grid .anime-card').first()).toBeVisible();

  expect(failures).toEqual([]);
});

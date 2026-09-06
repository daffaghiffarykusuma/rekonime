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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
});

test('mobile filters, menu, and sidebar work with touch', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('.quick-filters-summary').tap();
  for (const tab of ['Genres', 'Themes']) {
    await page.getByRole('tab', { name: tab, exact: true }).tap();
    const gap = await page.evaluate(() => document.querySelector('.quick-filters-panel').getBoundingClientRect().top
      - document.querySelector('.quick-filters-tabs').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(12);
  }
  await page.locator('.header-more-toggle').tap();
  await expect(page.locator('.header-controls .watchlist-link:visible, .mobile-watchlist-link:visible')).toHaveCount(1);
  await expect(page.locator('.header-more .help-label')).toBeVisible();

  for (const path of ['/', '/watchlist.html']) {
    for (const mode of ['auto-hide', 'compact', 'expanded']) {
      await page.evaluate(mode => localStorage.setItem('rekonime.sidebarMode', mode), mode);
      await page.goto(path);
      const trigger = page.getByRole('button', { name: 'Show navigation', exact: true });
      await trigger.tap();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('button', { name: 'Close navigation', exact: true }).tap();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(trigger).toBeFocused();
      await expect.poll(() => page.locator('.app-sidebar').evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
      expect(await page.evaluate(() => localStorage.getItem('rekonime.sidebarMode'))).toBe(mode);
      await trigger.tap();
      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await trigger.tap();
      await page.touchscreen.tap(370, 300);
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }
  }
  await context.close();
});

test('production build supports browse, full catalog, search, details, and watchlist', async ({ page, context }) => {
  const failures = installFailureCollectors(page);
  const catalogRequests = [];

  await context.route('https://api.jikan.moe/**', (route) => {
    const isReviewsRequest = route.request().url().includes('/reviews');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isReviewsRequest
        ? { data: [], pagination: { has_next_page: false } }
        : { data: { synopsis: 'Production smoke synopsis.' } })
    });
  });
  await context.route('https://graphql.anilist.co/**', (route) => route.fulfill({
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
  const usableCatalogTiming = await page.evaluate(() => {
    const mark = performance.getEntriesByName('rekonime:catalog-content-rendered').at(-1);
    return mark ? mark.startTime : null;
  });
  expect(usableCatalogTiming).not.toBeNull();
  await page.waitForSelector('#anime-grid .anime-card');
  await expect(page.locator('#anime-grid .anime-card').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-catalog-status', 'full');
  expect(catalogRequests).toContain('/data/anime.full.index.json');
  expect(catalogRequests).not.toContain('/data/anime.preview.json');
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
  await expect(page.locator('#detail-modal.visible')).toContainText(/Episodes|Franchise|Finish Rate/i);
  await page.waitForSelector('#watchlist-select');
  await page.selectOption('#watchlist-select', 'planned');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  await expect(page.locator('#watchlist-grid .anime-card').first()).toBeVisible();

  expect(failures).toEqual([]);
});

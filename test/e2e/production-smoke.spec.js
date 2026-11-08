import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildPrivacySafeMalExport } from '../helpers/mal-watchlist-fixture.js';

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
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await expect(page.locator('#quick-filters')).not.toHaveAttribute('inert', '');
  const filterSort = page.getByRole('button', { name: 'Filter & sort', exact: true });
  await filterSort.tap();
  const sheet = page.getByRole('dialog', { name: 'Filter & sort', exact: true });
  const catalogOrder = sheet.getByRole('combobox', { name: 'Catalog order', exact: true });
  await catalogOrder.selectOption('satisfaction');
  await sheet.getByRole('button', { name: 'Show matches' }).tap();
  await filterSort.tap();
  await expect(catalogOrder).toHaveValue('satisfaction');
  await sheet.getByRole('button', { name: 'Show matches' }).tap();
  await page.locator('.quick-filters-summary').tap();
  await expect(page.locator('#quick-filters')).toHaveJSProperty('open', true);
  for (const tab of ['Genres', 'Themes']) {
    await page.getByRole('tab', { name: tab, exact: true }).tap();
    const gap = await page.evaluate(() => document.querySelector('.quick-filters-panel').getBoundingClientRect().top
      - document.querySelector('.quick-filters-tabs').getBoundingClientRect().bottom);
    expect(gap).toBeGreaterThanOrEqual(12);
  }
  await page.locator('.header-more-toggle').tap();
  await expect(page.locator('.header-controls .watchlist-link:visible, .mobile-watchlist-link:visible')).toHaveCount(1);
  await expect(page.locator('.header-more .help-label')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('mobile-catalog.png') });

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
  const scriptRequests = [];

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
    if (url.pathname.startsWith('/js/')) scriptRequests.push(url.pathname);
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
  expect(scriptRequests).not.toContain('/js/detail-presentation.js');
  expect(scriptRequests).not.toContain('/js/mal-watchlist-import.js');
  await page.screenshot({ path: test.info().outputPath('desktop-catalog.png') });

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
  expect(scriptRequests).toContain('/js/detail-presentation.js');
  await page.selectOption('#watchlist-select', 'planned');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  await expect(page.locator('#watchlist-grid .anime-card').first()).toBeVisible();

  expect(failures).toEqual([]);
});

test('production deep links load detail code and close back to browsing', async ({ page }) => {
  const anime = JSON.parse(readFileSync('dist/data/anime.full.index.json', 'utf8')).anime[0];
  await page.goto(`/?anime=${encodeURIComponent(anime.id)}`);
  await expect(page.locator('#detail-content')).toContainText(anime.title);
  await expect(page.locator('#detail-modal')).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => entry.name.endsWith('/js/detail-presentation.js')))).toBe(true);
  await page.locator('#close-detail').click();
  await expect(page.locator('#detail-modal')).not.toBeVisible();
  expect(new URL(page.url()).searchParams.has('anime')).toBe(false);
});

test('production MAL import loads tools on file selection and applies a reviewed batch', async ({ page }) => {
  const scripts = [];
  page.on('request', request => scripts.push(new URL(request.url()).pathname));
  const catalog = JSON.parse(readFileSync('dist/data/anime.full.index.json', 'utf8')).anime;
  const xml = buildPrivacySafeMalExport(catalog, { matched: 1, unmatched: 1 });
  await page.goto('/watchlist.html');
  await page.getByText('Manage data', { exact: true }).click();
  expect(scripts).not.toContain('/js/app.js');
  await page.getByRole('button', { name: 'Import MAL progress', exact: true }).click();
  await expect(page.locator('#mal-watchlist-import-file')).toBeVisible();
  expect(scripts).not.toContain('/js/mal-watchlist-import.js');
  await page.locator('#mal-watchlist-import-file').setInputFiles({
    name: 'watchlist.xml', mimeType: 'application/xml', buffer: Buffer.from(xml)
  });
  await expect(page.getByRole('heading', { name: '2 rows are ready to review' })).toBeVisible();
  expect(scripts).toContain('/js/mal-watchlist-import.js');
  await expect(page.locator('[data-mal-count="matched"]')).toHaveText('1');
  await expect(page.locator('[data-mal-count="unmatched"]')).toHaveText('1');
  expect(await page.evaluate(() => localStorage.getItem('rekonime.watchlist'))).toBeNull();
  await page.getByRole('button', { name: 'Review 1 Watchlist changes' }).click();
  await page.getByRole('button', { name: 'Apply Watchlist changes' }).click();
  await expect(page.getByRole('heading', { name: '1 Watchlist entries imported' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rekonime.watchlist')).entries.length)).toBe(1);
});

for (const width of [1280, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`production Watchlist Manage data is readable and operable at ${width}px in ${theme}`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ baseURL, viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 });
      const anime = JSON.parse(readFileSync('dist/data/anime.full.index.json', 'utf8')).anime.find(item => item.episodeCount > 4 && item.malId);
      await context.addInitScript(({ anime, theme }) => {
        localStorage.setItem('rekonime.theme', theme);
        localStorage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, entries: [{ id: anime.id, status: 'watching', progress: 3, updatedAt: 1000, snapshot: anime }] }));
      }, { anime, theme });
      await context.route('https://graphql.anilist.co/**', route => route.fulfill({ json: { data: { Page: { media: [] } } } }));
      const page = await context.newPage();
      await page.goto('/watchlist.html');
      const manage = page.getByText('Manage data', { exact: true });
      const progress = page.locator('#watchlist-grid input[type="number"]');
      await expect(progress).toHaveValue('3');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const scale of [100, 200]) {
        await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, scale);
        test.info().annotations.push({ type: 'page-width', description: `${width}px ${theme} ${scale}% root text: ${await page.evaluate(() => document.documentElement.scrollWidth)}px` });
        await expect(page.getByRole('button', { name: 'Export backup', exact: true })).toBeHidden();
        await page.screenshot({ path: test.info().outputPath(`watchlist-${width}-${theme}-${scale}-closed.png`), fullPage: true });
        if (width === 390) await manage.tap();
        else { await manage.focus(); await page.keyboard.press('Enter'); }
        for (const name of ['Export backup', 'Restore backup', 'Import MAL progress']) {
          const button = page.getByRole('button', { name, exact: true });
          await expect(button).toBeVisible();
          const box = await button.boundingBox();
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        await expect(progress).toHaveValue('3');
        await page.screenshot({ path: test.info().outputPath(`watchlist-${width}-${theme}-${scale}-open.png`), fullPage: true });
        if (width === 390) await manage.tap();
        else { await manage.focus(); await page.keyboard.press('Space'); }
        await expect(progress).toHaveValue('3');
      }
      await context.close();
    });
  }
}

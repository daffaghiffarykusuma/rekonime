import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.tourStep', '0');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
});

test('home renders catalog grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  const count = await page.locator('#anime-grid .anime-card').count();
  expect(count).toBeGreaterThan(0);
});

test('open detail modal from grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  await page.locator('#anime-grid .anime-card').first().click();
  await page.waitForSelector('#detail-modal.visible');
  await expect(page.locator('#detail-modal.visible')).toBeVisible();
});

test('header search shows dropdown state', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');

  await page.click('#header-search');
  await page.fill('#header-search', 'zzzz');
  await page.waitForSelector('#header-search-dropdown.visible');
  await page.waitForSelector('.search-no-results');
});

test('surprise me opens detail modal', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  await page.waitForSelector('#surprise-toggle');
  await page.click('#surprise-toggle');
  await page.waitForSelector('#detail-modal.visible', { timeout: 15000 });
  await expect(page.locator('#detail-modal.visible')).toBeVisible();
});

test('watchlist flow persists to watchlist page', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  await page.locator('#anime-grid .anime-card').first().click();
  await page.waitForSelector('#detail-modal.visible');
  await page.waitForSelector('#watchlist-select');
  await page.selectOption('#watchlist-select', 'planned');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  const count = await page.locator('#watchlist-grid .anime-card').count();
  expect(count).toBeGreaterThan(0);
});

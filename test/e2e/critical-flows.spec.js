import { test, expect } from '@playwright/test';

const contrastRatio = (foreground, background) => {
  const luminance = (color) => {
    const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number);
    return channels.reduce((sum, channel, index) => {
      const normalized = channel / 255;
      const linear = normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.tourStep', '0');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
});

test('first-run intent choices are usable before entering discovery', async ({ browser }) => {
  const shellPage = await browser.newPage();
  await shellPage.route('**/js/main.ts', (route) => route.abort());
  await shellPage.goto('/');
  const shellChoice = shellPage.locator('.onboarding-intent-card').first();
  await expect(shellChoice).toBeVisible();
  await expect(shellChoice).toBeDisabled();
  await expect(shellChoice).toHaveCSS('cursor', 'progress');
  await shellPage.close();

  const page = await browser.newPage();
  await page.goto('/');

  const choices = page.locator('.onboarding-intent-card');
  await expect(choices).toHaveCount(3);
  await expect(choices.first()).toBeVisible();
  await expect(choices.first()).toBeEnabled();
  expect(await choices.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-pressed'))))
    .toEqual(['false', 'false', 'false']);

  const presentation = await choices.first().evaluate((button) => {
    const styles = getComputedStyle(button);
    return {
      height: button.getBoundingClientRect().height,
      borderColor: styles.borderColor,
      textAlign: styles.textAlign,
      cursor: styles.cursor
    };
  });

  expect(presentation.height).toBeGreaterThanOrEqual(64);
  expect(presentation.textAlign).toBe('left');
  expect(presentation.cursor).toBe('pointer');

  await choices.first().hover();
  await expect.poll(() => choices.first().evaluate((button) => getComputedStyle(button).borderColor))
    .not.toBe(presentation.borderColor);

  await choices.first().focus();
  await expect(choices.first()).toBeFocused();
  expect(await choices.first().evaluate((button) => getComputedStyle(button).outlineStyle))
    .not.toBe('none');

  await page.setViewportSize({ width: 390, height: 844 });
  const narrowBox = await choices.first().boundingBox();
  expect(narrowBox.x).toBeGreaterThanOrEqual(0);
  expect(narrowBox.x + narrowBox.width).toBeLessThanOrEqual(390);
  expect(narrowBox.height).toBeGreaterThanOrEqual(64);

  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(choices.nth(2)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(choices.nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(choices.nth(2)).toHaveCSS('border-color', 'rgb(184, 82, 132)');
  expect(await choices.evaluateAll((buttons) => buttons.map((button) => button.disabled)))
    .toEqual([true, true, true]);
  await expect(page.locator('#onboarding-modal')).toBeHidden();
  await expect(page.locator('#viewing-intent-options .mood-cluster[aria-pressed="true"]'))
    .toContainText('Surprise me');
});

test('light-theme Airing Schedule keeps readable foreground contrast', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  await page.locator('#anime-grid .anime-card').first().click();
  await page.waitForSelector('#watchlist-select');
  await page.selectOption('#watchlist-select', 'planned');
  await page.evaluate(() => localStorage.setItem('rekonime.theme', 'light'));

  await page.goto('/watchlist.html');
  const panel = page.locator('.airing-dashboard-section');
  await expect(panel).toBeVisible();
  await expect(page.locator('.airing-dashboard-empty')).toBeVisible();

  const colors = await panel.evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    foregrounds: [
      element.querySelector('h2'),
      element.querySelector('.airing-summary-value'),
      element.querySelector('.airing-summary-label'),
      element.querySelector('.airing-dashboard-empty')
    ].map((node) => getComputedStyle(node).color)
  }));

  for (const color of colors.foregrounds) {
    expect(contrastRatio(color, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
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
  const feedback = page.locator('.toast').filter({ hasText: 'Saved to Want to watch' });
  await expect(feedback).toBeVisible();
  await expect(feedback.getByRole('link', { name: 'View watchlist' }))
    .toHaveAttribute('href', '/watchlist.html');
  await page.selectOption('#watchlist-select', 'watching');
  await expect(page.locator('.toast')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText('Saved to Watching now');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  const count = await page.locator('#watchlist-grid .anime-card').count();
  expect(count).toBeGreaterThan(0);
});

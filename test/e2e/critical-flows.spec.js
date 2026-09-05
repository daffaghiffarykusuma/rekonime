import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildPrivacySafeMalExport } from '../helpers/mal-watchlist-fixture.js';

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

const expectBoxWithinViewport = (box, { width, height }, inset = 16) => {
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(inset);
  expect(box.y).toBeGreaterThanOrEqual(inset);
  expect(box.x + box.width).toBeLessThanOrEqual(width - inset);
  expect(box.y + box.height).toBeLessThanOrEqual(height - inset);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
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
  const accentColor = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--accent-primary)';
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(choices.nth(2)).toHaveCSS('border-color', accentColor);
  expect(await choices.evaluateAll((buttons) => buttons.map((button) => button.disabled)))
    .toEqual([true, true, true]);
  await expect(page.locator('#onboarding-modal')).toBeHidden();
  await expect(page.locator('#active-viewing-intent')).toContainText('Surprise me');
});

test('selected viewing intent collapses to a changeable summary', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');

  const options = page.locator('#viewing-intent-options');
  await options.getByRole('button', { name: /Help me unwind/ }).click();

  const summary = page.locator('#active-viewing-intent');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Help me unwind');
  await expect(page.locator('#recommendations-context')).toContainText('Help me unwind');
  await expect(page.locator('#recommendations-grid .recommendation-card').first().locator('.recommendation-reason'))
    .toContainText('Gentle');
  const firstRecommendation = page.locator('#recommendations-grid .recommendation-card').first();
  await expect(firstRecommendation.locator('.recommendation-signal-value')).toHaveCount(1);
  await expect(firstRecommendation.locator('.recommendation-stat')).toHaveCount(1);
  await expect(firstRecommendation.locator('.recommendation-stat')).toContainText('Community Score');
  await expect(firstRecommendation.locator('.experience-cue')).toHaveCount(1);
  await expect(options.locator('.viewing-intent-option')).toHaveCount(0);
  await expect(page.locator('#quick-filters')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const summaryBox = await summary.boundingBox();
  expect(summaryBox.x).toBeGreaterThanOrEqual(0);
  expect(summaryBox.x + summaryBox.width).toBeLessThanOrEqual(390);
  const intentSectionBox = await page.locator('#viewing-intent-section').boundingBox();
  expect(intentSectionBox.height).toBeLessThanOrEqual(140);
  await expect(page.locator('#discovery-garden')).toBeHidden();
  await expect(page.locator('.header-more-toggle')).toBeVisible();
  const firstRecommendationBox = await page.locator('#recommendations-grid .recommendation-card').first().boundingBox();
  expect(firstRecommendationBox.y).toBeLessThan(844);

  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await expect(page.locator('#discovery-garden')).toBeHidden();
  const reloadedSummary = page.locator('#active-viewing-intent');
  await expect(reloadedSummary).toBeVisible();
  await reloadedSummary.getByRole('button', { name: 'Change' }).click();
  await expect(options.locator('.viewing-intent-option')).toHaveCount(5);
  await expect(options.locator('.viewing-intent-option').first()).toBeFocused();
  await expect(options.getByRole('button', { name: /Help me unwind/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#recommendations-context')).toContainText('Help me unwind');

  await options.getByRole('button', { name: /Give me energy/ }).click();
  await expect(page.locator('#active-viewing-intent')).toContainText('Give me energy');
  await expect(page.locator('#recommendations-grid .recommendation-card').first().locator('.recommendation-reason'))
    .toContainText('High energy');
});

test('recommendation quick-save persists without replacing detail access', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.getByRole('button', { name: /Help me unwind/ }).click();

  const firstCard = page.locator('#recommendations-grid .recommendation-card').first();
  const title = (await firstCard.locator('.recommendation-title').textContent()).trim();
  const save = firstCard.getByRole('button', { name: `Want to watch ${title}`, exact: true });
  await expect(save).toBeVisible();

  await firstCard.focus();
  await firstCard.click({ position: { x: 20, y: 20 } });
  const detailModal = page.locator('#detail-modal.visible');
  await expect(detailModal).toBeVisible();
  await expect(detailModal.locator('[role="dialog"]')).toHaveCount(0);
  await expect(detailModal.locator('.detail-verdict-value')).toHaveCount(1);
  await expect(detailModal.locator('.detail-stat-label')).toHaveCount(2);
  await expect(detailModal.locator('.detail-stat-label', { hasText: 'Finish Confidence' })).toHaveCount(0);
  for (const tab of await detailModal.locator('.detail-tab').all()) {
    await tab.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(tab).toBeFocused();
    expect(await tab.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  }
  const closeBox = await page.getByRole('button', { name: 'Close details' }).boundingBox();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Close details' }).click();
  await expect(firstCard).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  const saveBox = await save.boundingBox();
  expect(saveBox.x + saveBox.width).toBeLessThanOrEqual(390);
  await save.focus();
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');

  const toast = page.getByRole('status').filter({ hasText: 'Saved to Want to watch' });
  await expect(toast).toBeVisible();
  await expect(page.locator('#recommendations-grid .recommendation-card').filter({ has: page.getByRole('button', { name: `Want to watch ${title}`, exact: true }) })).toHaveCount(0);
  await toast.getByRole('link', { name: 'View watchlist' }).click();
  await expect(page).toHaveURL(/watchlist\.html/);
  await expect(page.locator('.card-title', { hasText: title })).toBeVisible();

});

test('complete discovery-to-watchlist journey', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4173', viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');

  const onboardingChoice = page.locator('.onboarding-intent-card').first();
  await expect(onboardingChoice).toBeVisible();
  await expect(onboardingChoice).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  const onboardingBox = await onboardingChoice.boundingBox();
  expect(onboardingBox.x + onboardingBox.width).toBeLessThanOrEqual(390);
  await onboardingChoice.focus();
  await expect(onboardingChoice).toBeFocused();
  expect(await onboardingChoice.evaluate((button) => getComputedStyle(button).outlineStyle)).not.toBe('none');
  await onboardingChoice.click();

  await expect(page.locator('#active-viewing-intent')).toContainText('Help me unwind');
  const card = page.locator('#recommendations-grid .recommendation-card').first();
  await expect(card.locator('.recommendation-reason')).toContainText('Gentle');
  await expect(card.locator('.experience-cue')).toHaveCount(1);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(390);
  const title = (await card.locator('.recommendation-title').textContent()).trim();

  await card.click({ position: { x: 20, y: 20 } });
  await expect(page.locator('#detail-modal.visible')).toBeVisible();
  await page.getByRole('button', { name: 'Close details' }).click();

  const save = page.getByRole('button', { name: `Want to watch ${title}`, exact: true });
  await save.focus();
  await expect(save).toBeFocused();
  await page.keyboard.press('Enter');
  const toast = page.getByRole('status').filter({ hasText: 'Saved to Want to watch' });
  await expect(toast).toBeVisible();
  await expect(toast).toHaveAttribute('aria-live', 'polite');
  await toast.getByRole('link', { name: 'View watchlist' }).click();

  const watchCard = page.locator('#watchlist-grid .anime-card').filter({ hasText: title });
  await expect(watchCard).toBeVisible();
  const status = watchCard.locator('.watchlist-controls-select');
  await expect(status).toHaveValue('planned');
  await status.selectOption('watching');
  const progress = watchCard.locator('.watchlist-controls-input');
  await expect(progress).toBeVisible();
  await progress.fill('1');
  await progress.press('Enter');
  await expect(progress).toHaveValue('1');

  const panel = page.locator('.airing-dashboard-section');
  await expect(panel).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((nextTheme) => {
      localStorage.setItem('rekonime.theme', nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    }, theme);
    const colors = await panel.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      foregrounds: [
        'h2',
        '.airing-summary-value',
        '.airing-summary-label',
        '.airing-dashboard-empty',
        '.airing-dashboard-link'
      ].flatMap((selector) => [...element.querySelectorAll(selector)])
        .filter((node) => getComputedStyle(node).display !== 'none')
        .map((node) => getComputedStyle(node).color)
    }));
    for (const foreground of colors.foregrounds) {
      expect(contrastRatio(foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    }
  }

  const watchBox = await watchCard.boundingBox();
  expect(watchBox.x).toBeGreaterThanOrEqual(0);
  expect(watchBox.x + watchBox.width).toBeLessThanOrEqual(390);
  await status.focus();
  await expect(status).toBeFocused();
  expect(await status.evaluate((select) => getComputedStyle(select).boxShadow)).not.toBe('none');
  const panelBox = await panel.boundingBox();
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(390);
  await context.close();
});

test('light-theme Airing Schedule keeps readable foreground contrast', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  await page.locator('#anime-grid .anime-card').first().click();
  await page.waitForSelector('#watchlist-select');
  await page.locator('#watchlist-select').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#watchlist-select')).toHaveValue('planned');
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

test('tertiary review attribution remains readable in both themes and narrow layouts', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.locator('#anime-grid .anime-card').first().click();
  await page.getByRole('tab', { name: 'Reviews' }).click();
  const attribution = page.locator('.reviews-attribution');
  await expect(attribution).toBeVisible();

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate((nextTheme) => { document.documentElement.dataset.theme = nextTheme; }, theme);
      const colors = await attribution.evaluate((element) => {
        const foreground = getComputedStyle(element).color;
        let background = 'rgba(0, 0, 0, 0)';
        for (let node = element; node && background === 'rgba(0, 0, 0, 0)'; node = node.parentElement) {
          background = getComputedStyle(node).backgroundColor;
        }
        return { foreground, background };
      });
      expect(contrastRatio(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
    }
    const modalBox = await page.locator('#detail-modal .modal-content').boundingBox();
    expect(modalBox.x).toBeGreaterThanOrEqual(0);
    expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(width);
  }
});

test('advanced filters stay actionable while long groups remain progressive', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.getByRole('button', { name: 'Filters' }).click();

  const modal = page.locator('#filter-modal.visible');
  await expect(modal).toBeVisible();
  await expect(modal.locator('.preset-card-icon')).toHaveCount(0);

  const studios = modal.locator('details').filter({ hasText: 'Studios' });
  const sources = modal.locator('details').filter({ hasText: 'Sources' });
  await expect(studios).not.toHaveAttribute('open');
  await expect(sources).not.toHaveAttribute('open');
  await studios.locator('summary').click();
  await expect(studios).toHaveAttribute('open');

  await page.setViewportSize({ width: 390, height: 844 });
  const interactiveControls = [
    modal.locator('.preset-card').first(),
    studios.locator('summary'),
    modal.getByRole('button', { name: 'Add Action filter' }),
    modal.getByRole('button', { name: 'Reset all' }),
    modal.getByRole('button', { name: 'Show matches' })
  ];
  for (const control of interactiveControls) {
    await control.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(control).toBeFocused();
    const styles = await control.evaluate((element) => ({
      outline: getComputedStyle(element).outlineStyle,
      shadow: getComputedStyle(element).boxShadow
    }));
    expect(styles.outline !== 'none' || styles.shadow !== 'none').toBe(true);
  }
  for (const control of [studios.locator('summary'), modal.getByRole('button', { name: 'Add Action filter' })]) {
    const box = await control.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  const modalBox = await modal.locator('.filter-modal-content').boundingBox();
  expect(modalBox.x).toBeGreaterThanOrEqual(0);
  expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(390);

  const body = modal.locator('.filter-modal-body');
  await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect(modal.getByRole('button', { name: 'Reset all' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Show matches' })).toBeVisible();

  await modal.getByRole('button', { name: 'Add Action filter' }).click();
  await modal.getByRole('button', { name: 'Show matches' }).click();
  await expect(modal).toBeHidden();
  await expect(page.locator('#active-filters')).toContainText('Action');
});

test('home renders catalog grid', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#anime-grid .anime-card');
  const count = await page.locator('#anime-grid .anime-card').count();
  expect(count).toBeGreaterThan(0);
  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const hero = await page.locator('#discovery-garden').boundingBox();
    const recommendations = await page.locator('#recommendations-section').boundingBox();
    expect(hero.y + hero.height).toBeLessThanOrEqual(recommendations.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const card = page.locator('#anime-grid .anime-card').first();
    await card.scrollIntoViewIfNeeded();
    const cover = await card.locator('.card-cover').boundingBox();
    const title = await card.locator('.card-title').boundingBox();
    expect(title.y - (cover.y + cover.height)).toBeLessThanOrEqual(24);
  }
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
  await expect(page.locator('#watchlist-select')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#watchlist-select')).toHaveValue('watching');
  await expect(page.locator('.toast')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText('Saved to Watching now');

  await page.goto('/watchlist.html');
  await page.waitForSelector('#watchlist-grid .anime-card');
  const count = await page.locator('#watchlist-grid .anime-card').count();
  expect(count).toBeGreaterThan(0);
});

test('MAL XML first import previews exact matches before one confirmed batch', async ({ page }) => {
  const fullCatalog = JSON.parse(readFileSync('data/anime.full.json', 'utf8')).anime;
  const xml = buildPrivacySafeMalExport(fullCatalog);
  await page.route('**/watchlist.html', async route => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': "trusted-types rekonime-html; require-trusted-types-for 'script'"
      }
    });
  });
  await page.goto('/watchlist.html');
  await page.getByRole('button', { name: 'Import from MAL' }).click();

  await page.locator('#mal-watchlist-import-file').setInputFiles({
    name: 'watchlist.xml',
    mimeType: 'application/xml',
    buffer: Buffer.from(xml)
  });
  await expect(page.getByRole('heading', { name: '415 rows are ready to review' })).toBeVisible();
  await expect(page.locator('[data-mal-count="matched"]')).toHaveText('339');
  await expect(page.locator('[data-mal-count="unmatched"]')).toHaveText('76');
  await expect(page.locator('.mal-import-counts')).toHaveCSS('display', 'grid');

  await page.getByRole('button', { name: 'Review 339 Watchlist changes' }).click();
  const dialog = page.locator('#mal-import-confirmation');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('width', '512px');
  const dialogRadius = await dialog.evaluate(element => getComputedStyle(element).getPropertyValue('--radius').trim());
  await expect(dialog).toHaveCSS('border-top-left-radius', dialogRadius);
  await expect(dialog).not.toHaveCSS('box-shadow', 'none');
  await expect(dialog.getByRole('button', { name: 'Go back' })).toBeFocused();

  const desktopBox = await dialog.boundingBox();
  expect(desktopBox).not.toBeNull();
  expect(Math.abs(desktopBox.x + desktopBox.width / 2 - 640)).toBeLessThanOrEqual(1);
  expect(Math.abs(desktopBox.y + desktopBox.height / 2 - 360)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.locator('.mal-import-actions')).toHaveCSS('flex-direction', 'column');
  const mobileBox = await dialog.boundingBox();
  expectBoxWithinViewport(mobileBox, { width: 390, height: 844 });

  // A 1280 × 720 desktop viewport at 200% zoom exposes a 640 × 360 CSS viewport.
  await page.setViewportSize({ width: 640, height: 360 });
  const zoomBox = await dialog.boundingBox();
  expectBoxWithinViewport(zoomBox, { width: 640, height: 360 });
  await dialog.getByRole('button', { name: 'Apply Watchlist changes' }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole('button', { name: 'Go back' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: 'Apply Watchlist changes' })).toBeInViewport();

  await dialog.getByRole('button', { name: 'Apply Watchlist changes' }).click();

  await expect(page.getByRole('heading', { name: '339 Watchlist entries imported' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rekonime.watchlist')).entries.length)).toBe(339);
  await expect(page.locator('#watchlist-grid .anime-card')).toHaveCount(339);
});

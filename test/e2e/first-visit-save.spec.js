import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`failed Discovery save can be retried with the keyboard at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('rekonime.onboarding', 'completed');
      localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
    await page.getByRole('button', { name: /Help me unwind/ }).click();
    const card = page.locator('#recommendations-grid .recommendation-card').first();
    const title = (await card.locator('.recommendation-title').textContent()).trim();
    const save = page.getByRole('button', { name: `Want to watch ${title}`, exact: true });
    const previous = await page.evaluate(() => {
      const write = Storage.prototype.setItem;
      window.blockWatchlistSave = true;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === 'rekonime.watchlist' && window.blockWatchlistSave) {
          throw new DOMException('Storage unavailable', 'QuotaExceededError');
        }
        return write.call(this, key, value);
      };
      return {
        watchlist: localStorage.getItem('rekonime.watchlist'),
        tasteProfile: localStorage.getItem('rekonime.tasteProfile')
      };
    });
    await save.focus();
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');

    const failure = page.getByRole('status').filter({ hasText: "Couldn't save your Watchlist change" });
    await expect(failure).toBeVisible();
    await expect(failure).toHaveAttribute('aria-live', 'assertive');
    await expect(failure).toContainText('Try again');
    await expect(page.getByRole('status').filter({ hasText: 'Saved to Want to watch' })).toHaveCount(0);
    await expect(save).toBeFocused();
    const box = await failure.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(await page.evaluate(() => ({
      watchlist: localStorage.getItem('rekonime.watchlist'),
      tasteProfile: localStorage.getItem('rekonime.tasteProfile')
    }))).toEqual(previous);

    await page.evaluate(() => { window.blockWatchlistSave = false; });
    await page.keyboard.press('Enter');
    const success = page.getByRole('status').filter({ hasText: 'Saved to Want to watch' });
    await expect(success).toBeVisible();
    await expect(success).toHaveAttribute('aria-live', 'polite');
    await success.getByRole('link', { name: 'View watchlist' }).click();
    await expect(page.locator('.card-title', { hasText: title })).toBeVisible();
    await page.reload();
    const savedCard = page.locator('.anime-card').filter({ has: page.locator('.card-title', { hasText: title }) });
    await expect(savedCard).toBeVisible();
    await expect(savedCard.locator('[data-action="watch-status"]')).toHaveValue('planned');
  });
}

import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`a chosen title remains visible with keyboard Undo and persists in Watchlist at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('rekonime.onboarding', 'completed');
      localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
    await page.getByRole('button', { name: /Help me unwind/ }).click();
    const title = (await page.locator('#recommendations-grid .recommendation-title').first().textContent()).trim();
    const save = page.getByRole('button', { name: `Want to watch ${title}`, exact: true });
    await save.focus();
    await page.keyboard.press('Enter');

    const selected = page.getByRole('region', { name: 'Your chosen title' });
    await expect(selected).toBeVisible();
    await expect(selected).toContainText(title);
    await expect(selected).toContainText('Saved to Want to watch');
    const undo = selected.getByRole('button', { name: `Undo saving ${title}`, exact: true });
    await expect(undo).toBeFocused();
    const box = await selected.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Enter');
    await expect(selected).toBeHidden();
    await expect(page.locator('#recommendations-status')).toContainText(`Undid saving ${title}`);
    await expect(save).toBeVisible();
    await expect(save).toBeFocused();
    await page.keyboard.press('Enter');
    await selected.getByRole('link', { name: 'View watchlist' }).click();
    await page.reload();
    const card = page.locator('.anime-card').filter({ has: page.locator('.card-title', { hasText: title }) });
    await expect(card).toBeVisible();
    await expect(card.locator('[data-action="watch-status"]')).toHaveValue('planned');
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
    await expect(page.getByRole('region', { name: 'Your chosen title' })).toBeHidden();
    await expect(page.getByRole('button', { name: `Want to watch ${title}`, exact: true })).toHaveCount(0);
  });
}

test('failed selection Undo stays retryable and a newer Watchlist change is protected', async ({ page, context }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.getByRole('button', { name: /Help me unwind/ }).click();
  const title = (await page.locator('#recommendations-grid .recommendation-title').first().textContent()).trim();
  await page.getByRole('button', { name: `Want to watch ${title}`, exact: true }).click();
  const selected = page.getByRole('region', { name: 'Your chosen title' });
  const undo = selected.getByRole('button', { name: `Undo saving ${title}`, exact: true });
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    window.blockSelectionUndo = true;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === 'rekonime.watchlist' && window.blockSelectionUndo) throw new DOMException('Full', 'QuotaExceededError');
      return write.call(this, key, value);
    };
  });
  await undo.click();
  await expect(page.getByRole('status').filter({ hasText: "Couldn't save your Watchlist change" })).toBeVisible();
  await expect(selected).toBeVisible();
  await expect(undo).toBeFocused();
  await page.evaluate(() => { window.blockSelectionUndo = false; });
  await undo.click();
  await expect(selected).toBeHidden();
  await page.getByRole('button', { name: `Want to watch ${title}`, exact: true }).click();

  const otherTab = await context.newPage();
  await otherTab.goto('/watchlist.html');
  const savedCard = otherTab.locator('.anime-card').filter({ has: otherTab.locator('.card-title', { hasText: title }) });
  await savedCard.locator('[data-action="watch-status"]').selectOption('watching');
  await undo.click();
  await expect(page.locator('#recommendations-status')).toContainText('Your newer changes are preserved');
  await otherTab.reload();
  await expect(savedCard.locator('[data-action="watch-status"]')).toHaveValue('watching');
});

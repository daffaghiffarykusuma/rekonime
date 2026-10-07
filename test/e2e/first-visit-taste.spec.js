import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`lasting feedback is deliberate and reversible using a keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('rekonime.onboarding', 'completed');
      localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
    });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
    await page.getByRole('button', { name: /Help me unwind/ }).click();
    const card = page.locator('#recommendations-grid .recommendation-card').first();
    const id = await card.getAttribute('data-anime-id');
    const title = (await card.locator('.recommendation-title').textContent()).trim();
    const specificCard = page.locator(`#recommendations-grid .recommendation-card[data-anime-id="${id}"]`);
    await expect(specificCard.getByRole('button', { name: 'Not for me', exact: true })).not.toBeVisible();
    const disclosure = specificCard.locator('summary', { hasText: 'Taste preferences' });
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(specificCard).toContainText('Hide this title from future recommendations');
    const hide = specificCard.getByRole('button', { name: 'Not for me', exact: true });
    await hide.focus();
    await page.keyboard.press('Enter');
    await expect(specificCard).toHaveCount(0);
    const feedback = page.getByRole('status').filter({ hasText: `${title} hidden from future recommendations` });
    await expect(feedback).toBeVisible();
    const undo = feedback.getByRole('button', { name: 'Undo', exact: true });
    await expect(undo).toBeFocused();
    const bounds = await feedback.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Taste preference undone.' })).toBeVisible();
    await expect(specificCard).toBeVisible();
    await expect(specificCard.locator('summary', { hasText: 'Taste preferences' })).toBeFocused();
    await page.reload();
    await expect(specificCard).toBeVisible();
  });
}

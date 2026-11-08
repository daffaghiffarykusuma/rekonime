import { test, expect } from '@playwright/test';

test('catalog sheet shares sorting with desktop and preserves filtering and Discovery', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
  const anime = [
    { id: 'alpha', title: 'Alpha', communityScore: 7, genres: ['Action'], strength: 90 },
    { id: 'beta', title: 'Beta', communityScore: 9, genres: ['Action'], strength: 70 },
    { id: 'gamma', title: 'Gamma', communityScore: 8, genres: ['Comedy'], strength: 80 }
  ].map(({ strength, ...item }) => ({ ...item, year: 2026, studio: 'Fixture studio', cover: '', type: 'TV',
    themes: [], episodes: [{ episode: 1, score: 4 }],
    stats: { scoringVersion: 2, episodeCount: 1, retentionScore: strength } }));
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.locator('#viewing-intent-options').getByRole('button', { name: /Help me unwind/ }).click();
  const picks = await page.locator('#recommendations-grid .recommendation-title').allTextContents();
  const savedTaste = await page.evaluate(() => localStorage.getItem('rekonime.tasteProfile'));
  const trigger = page.getByRole('button', { name: 'Filter & sort', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Filter & sort', exact: true });
  const sort = sheet.getByRole('combobox', { name: 'Catalog order', exact: true });
  await expect(sort.locator('option')).toHaveCount(3);
  await expect(sort).toHaveValue('taste');
  await expect(sheet).toContainText('Personalized Discovery picks keep their own ranking');
  await sort.selectOption('satisfaction');
  await sheet.getByRole('button', { name: 'Show matches' }).click();
  await expect(trigger).toBeFocused();
  const titles = page.locator('#anime-grid .card-title');
  await expect(titles).toHaveText(['Beta', 'Gamma', 'Alpha']);
  await trigger.click();
  await expect(sort).toHaveValue('satisfaction');
  await sheet.getByRole('button', { name: 'Add Action filter', exact: true }).click();
  await sheet.getByRole('button', { name: 'Show matches' }).click();
  await expect(titles).toHaveText(['Beta', 'Alpha']);
  await expect(page).toHaveURL(/genre=Action/);
  await expect(page.locator('#active-filters')).toContainText('Action');
  await trigger.click();
  await sheet.getByRole('button', { name: 'Reset all' }).click();
  await expect(sort).toHaveValue('satisfaction');
  await sheet.getByRole('button', { name: 'Show matches' }).click();
  await expect(titles).toHaveText(['Beta', 'Gamma', 'Alpha']);
  expect(new URL(page.url()).searchParams.has('genre')).toBe(false);
  await page.setViewportSize({ width: 1280, height: 720 });
  const desktopSort = page.getByRole('combobox', { name: 'Sort anime', exact: true });
  await expect(desktopSort).toHaveValue('satisfaction');
  await desktopSort.selectOption('retention');
  await expect(titles).toHaveText(['Alpha', 'Gamma', 'Beta']);
  await trigger.click();
  await expect(sort).toHaveValue('retention');
  await sort.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(sort).toHaveValue('taste');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(desktopSort).toHaveValue('taste');
  await expect(page.locator('#active-viewing-intent')).toContainText('Help me unwind');
  expect(await page.locator('#recommendations-grid .recommendation-title').allTextContents()).toEqual(picks);
  expect(await page.evaluate(() => localStorage.getItem('rekonime.tasteProfile'))).toBe(savedTaste);
  await trigger.click();
  await sheet.getByRole('button', { name: /Community favorites/ }).click();
  await expect(sort).toHaveValue('satisfaction');
  await sheet.getByRole('button', { name: 'Show matches' }).click();
  await expect(desktopSort).toHaveValue('satisfaction');
  await expect(titles).toHaveText(['Beta', 'Gamma']);
  await trigger.click();
  await sheet.getByRole('button', { name: /^Stable episode ratings/ }).click();
  await expect(sort.locator('option:checked')).toHaveText('Highest episode rating strength');
  await sheet.getByRole('button', { name: 'Show matches' }).click();
  await expect(desktopSort.locator('option:checked')).toHaveText('Highest episode rating strength');
});

for (const theme of ['dark', 'light']) {
  for (const width of [1280, 390, 320]) {
    test(`Filter & sort remains usable in ${theme} at ${width}px`, async ({ page }, testInfo) => {
      await page.addInitScript(theme => {
        localStorage.setItem('rekonime.onboarding', 'completed');
        localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
        localStorage.setItem('rekonime.theme', theme);
      }, theme);
      await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
      if (width === 320) await page.addStyleTag({ content: 'html { font-size: 125%; }' });
      const trigger = page.getByRole('button', { name: 'Filter & sort', exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const sheet = page.getByRole('dialog', { name: 'Filter & sort', exact: true });
      const sort = sheet.getByRole('combobox', { name: 'Catalog order', exact: true });
      await expect(sort).toBeVisible();
      await expect(page.locator('#close-filter-modal')).toBeFocused();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await sort.selectOption('satisfaction');
      if (width === 320) await expect(sheet.getByText('Current order: Highest community rating', { exact: true })).toBeVisible();
      for (const control of [sort, sheet.getByRole('button', { name: 'Show matches' })]) {
        const box = await control.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.move(width - 2, 300);
      await page.mouse.wheel(0, 600);
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
      await page.screenshot({ path: testInfo.outputPath(`filter-sort-${theme}-${width}.png`) });
      await page.keyboard.press('Escape');
      await expect(sheet).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
}

import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
});

test('supporting exploration stays in Browse anime below the initial picks', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const browse = page.getByRole('region', { name: 'Browse anime', exact: true });
  await expect(browse).toBeVisible();
  await expect(page.locator('#recommendations-grid .recommendation-card')).toHaveCount(3);
  const picks = await page.locator('#recommendations-section').boundingBox();
  const shelf = await browse.boundingBox();
  expect(shelf.y).toBeGreaterThanOrEqual(picks.y + picks.height);
  await expect(browse.locator('#seasonal-filters')).toBeVisible();
  await expect(browse.locator('#trending-section')).toBeVisible();
  await expect(browse.locator('#catalog-section')).toBeVisible();
  await page.getByRole('button', { name: 'Explore genres', exact: true }).click();
  await expect(browse.getByRole('button', { name: 'Add Action filter', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Browse all titles', exact: true }).click();
  await expect(browse.locator('#anime-grid .anime-card').first()).toBeInViewport();
});

test('mobile Discovery leaves room for a pick and its actions', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  // Optional goals must not consume a full screen before the shortlist begins.
  const goals = await page.locator('#viewing-intent-section').boundingBox();
  expect(goals.height).toBeLessThan(260);
  const card = page.locator('#recommendations-grid .recommendation-card').first();
  await card.scrollIntoViewIfNeeded();
  const artwork = await card.locator('.recommendation-media').boundingBox();
  expect(artwork.height).toBeLessThanOrEqual(180);
  await expect(card.locator('.recommendation-title')).toBeInViewport();
  await expect(card.getByRole('button', { name: /^Want to watch / })).toBeInViewport();
  await page.getByRole('button', { name: /Help me unwind/ }).click();
  await expect(page.locator('#discovery-garden')).toBeHidden();
  await expect(page.locator('#active-viewing-intent')).toContainText('Help me unwind');
  await page.locator('#active-viewing-intent').getByRole('button', { name: 'Change', exact: true }).click();
  await expect(page.getByRole('button', { name: /Help me unwind/ })).toBeFocused();
});

for (const width of [1280, 390]) {
  for (const theme of ['dark', 'light']) {
    test(`Discovery visual inspection ${width}px ${theme}`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
      await page.addInitScript(nextTheme => localStorage.setItem('rekonime.theme', nextTheme), theme);
      await context.route('**/data/anime*.json*', route => route.fulfill({ json: { anime: [
        { id: 'long-title', title: 'A very long journey through another world with friends and an unexpectedly quiet afternoon', genres: ['Slice of Life'], themes: ['Iyashikei'], communityScore: 8, episodes: [] },
        { id: 'partial', title: 'Partial episode evidence', genres: ['Slice of Life'], themes: [], communityScore: 8, episodes: [{ episode: 7, score: 4 }], stats: { scoringVersion: 2, episodeCount: 7, retentionScore: 70, ratingEvidence: { totalEpisodes: null, ratedEpisodes: 1, limited: true, completion: 'airing' } } },
        { id: 'alternative', title: 'An alternative adventure', genres: ['Action'], themes: [], communityScore: 8, episodes: [] }
      ].map(item => ({ ...item, year: 2026, studio: 'Fixture studio', cover: '', type: 'TV' })) } }));
      const fresh = await context.newPage();
      await fresh.setViewportSize({ width, height: width === 390 ? 844 : 720 });
      await fresh.addInitScript(nextTheme => localStorage.setItem('rekonime.theme', nextTheme), theme);
      await fresh.goto('/');
      await expect(fresh.locator('.onboarding-intent-card').first()).toBeEnabled();
      await fresh.screenshot({ path: testInfo.outputPath('fresh-welcome.png'), animations: 'disabled' });
      await fresh.getByRole('button', { name: 'Skip to recommendations', exact: true }).click();
      await expect(fresh.locator('#onboarding-modal')).toBeHidden();
      await expect(fresh.locator('#discovery-garden')).toBeVisible();
      await fresh.screenshot({ path: testInfo.outputPath('fresh-skipped.png'), animations: 'disabled' });
      await fresh.close();
      await page.goto('/');
      await expect(page.locator('.recommendation-title').first()).toBeVisible();
      const capture = async name => {
        const path = testInfo.outputPath(`${name}.png`);
        await page.screenshot({ path, animations: 'disabled' });
        await testInfo.attach(name, { path, contentType: 'image/png' });
      };
      await capture('landing');
      await expect(page.locator('#discovery-garden')).toBeVisible();
      await page.getByRole('button', { name: /Help me unwind/ }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#discovery-garden')).toBeHidden();
      await capture('active-goal');
      const card = page.getByRole('group', { name: 'Partial episode evidence', exact: true });
      await card.getByText('Ratings and evidence', { exact: true }).focus();
      await page.keyboard.press('Enter');
      await card.scrollIntoViewIfNeeded();
      await expect(card).toContainText('total unknown');
      await capture('evidence');
      await page.getByRole('group', { name: /^A very long journey/ }).scrollIntoViewIfNeeded();
      await capture('long-title');
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await card.scrollIntoViewIfNeeded();
      await capture('large-text');
      const bounds = await card.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    });
  }
}

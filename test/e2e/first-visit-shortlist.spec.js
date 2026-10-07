import { test, expect } from '@playwright/test';

test('first-visit Discovery offers three picks, more on request, and keyboard-accessible rating evidence', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const cards = page.locator('#recommendations-grid .recommendation-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText(/episodes listed|observed.*total unknown|Episode count unknown/);
  const firstTitle = await cards.first().locator('.recommendation-title').textContent();
  const more = page.getByRole('button', { name: 'Show more picks', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(cards).toHaveCount(6);
  await expect(cards.first().locator('.recommendation-title')).toHaveText(firstTitle);
  await expect(cards.nth(3).locator('.recommendation-title')).toBeFocused();

  await page.locator('#viewing-intent-options').getByRole('button', { name: /Help me unwind/ }).click();
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Suggestions for this goal', exact: true })).toBeVisible();
  await expect(cards.first().locator('.recommendation-reason')).toContainText('slice-of-life');
  const ratings = cards.first().getByText('Ratings and evidence', { exact: true });
  await ratings.focus();
  await page.keyboard.press('Enter');
  await expect(cards.first().locator('.recommendation-signal-note')).toBeVisible();
  await expect(cards.first()).toContainText(/episodes rated|coverage unavailable/);
  await expect(cards.first()).toContainText('not a completion probability');

  await page.setViewportSize({ width: 390, height: 844 });
  await cards.first().scrollIntoViewIfNeeded();
  const box = await cards.first().boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await cards.first().locator('.recommendation-title').click();
  await expect(page.locator('#detail-modal.visible')).toBeVisible();
});

test('a goal with no matches labels alternatives and missing episode information honestly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rekonime.onboarding', 'completed'));
  const anime = [
    { id: 'unknown-episodes', title: 'Unknown episodes', genres: ['Action'], themes: [], communityScore: 8, episodes: [] },
    { id: 'partial-episodes', title: 'Partial episodes', genres: ['Action'], themes: [], communityScore: 8,
      episodes: [{ episode: 7, score: 4 }], stats: { scoringVersion: 2, episodeCount: 7, retentionScore: 70,
        ratingEvidence: { totalEpisodes: null, ratedEpisodes: 1, limited: true, completion: 'airing' } } }
  ].map(item => ({ ...item, year: 2026, studio: 'Fixture studio', cover: '', type: 'TV' }));
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await page.locator('#viewing-intent-options').getByRole('button', { name: /Help me unwind/ }).click();
  const grid = page.locator('#recommendations-grid');
  await expect(grid.getByRole('heading', { name: 'General alternatives', exact: true })).toBeVisible();
  await expect(grid).toContainText('No close matches for this goal.');
  await expect(grid.locator('.recommendation-card')).toHaveCount(2);
  await expect(grid).toContainText('Episode count unknown');
  await expect(grid).toContainText('Through episode 7 observed · total unknown');
  await expect(page.getByRole('button', { name: 'Show more picks', exact: true })).toBeHidden();
  const partial = grid.getByRole('group', { name: 'Partial episodes', exact: true });
  await partial.getByText('Ratings and evidence', { exact: true }).click();
  await expect(partial).toContainText('Provisional');
  await expect(page.locator('#detail-modal')).not.toBeVisible();
});

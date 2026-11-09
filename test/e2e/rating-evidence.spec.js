import { test, expect } from '@playwright/test';

const captureRatingLayouts = async (page, card, testInfo) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    for (const theme of ['dark', 'light']) {
      for (const scale of [100, 200]) {
        await page.evaluate(({ theme, scale }) => {
          document.documentElement.dataset.theme = theme;
          document.documentElement.style.fontSize = `${scale}%`;
        }, { theme, scale });
        await page.evaluate(() => document.fonts.ready);
        await card.scrollIntoViewIfNeeded();
        await card.screenshot({ path: testInfo.outputPath(`rating-${width}-${theme}-${scale}.png`), animations: 'disabled' });
      }
    }
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
};

test('ratings use named scales and MAL attribution from Discovery through catalog and details', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
  });
  const anime = [{ id: 'rating-example', title: 'A long title for comparing rating evidence across Discovery and the catalog', genres: ['Action'], themes: [], year: 2026, studio: 'Fixture studio', cover: '', type: 'TV', communityScore: 8.2,
    episodes: [{ episode: 7, score: 4 }], stats: { scoringVersion: 2, episodeCount: 7, retentionScore: 70,
      ratingEvidence: { totalEpisodes: null, ratedEpisodes: 1, limited: true, completion: 'airing' } } }];
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const pick = page.locator('#recommendations-grid').getByRole('group', { name: anime[0].title, exact: true });
  await pick.getByText('Ratings and evidence', { exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(pick.getByText('Episode Rating Strength', { exact: true })).toBeVisible();
  await expect(pick).toContainText('70/100');
  await expect(pick.getByText('Community Score (MAL)', { exact: true }).first()).toBeVisible();
  await expect(pick).toContainText('8.2/10');
  await expect(pick).toContainText('Provisional');
  await expect(pick).toContainText('total unknown');
  await expect(pick).toContainText('not a completion probability');
  const catalog = page.locator('#anime-grid .anime-card').first();
  await expect(catalog).toContainText('Episode Rating Strength');
  await expect(catalog).toContainText('Community Score (MAL)');
  await expect(page.locator('#sort-select option[value="satisfaction"]')).toHaveText('Highest Community Score (MAL, /10)');
  await expect(page.locator('#sort-select option[value="retention"]')).toHaveText('Highest Episode Rating Strength (/100)');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      await pick.scrollIntoViewIfNeeded();
      await pick.screenshot({ path: ` .scratch/ui-design/evidence/02/${anime[0].id}-discovery-${width}-${theme}.png`.trim() });
      await catalog.scrollIntoViewIfNeeded();
      await expect(catalog.getByText("Community Score (MAL)", { exact: true }).first()).toBeVisible();
      await catalog.screenshot({ path: `.scratch/ui-design/evidence/02/${anime[0].id}-catalog-${width}-${theme}.png` });
    }
  }
  await pick.locator('.recommendation-title').click();
  const detail = page.locator('#detail-modal');
  await expect(detail.getByText('Community Score (MAL)', { exact: true }).first()).toBeVisible();
  await expect(detail).toContainText('8.2/10');
  await expect(detail).toContainText('Episode Rating Strength');
});

test('known totals without episode polls show unavailable evidence rather than a measured zero', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rekonime.onboarding', 'completed'));
  const anime = [{ id: 'unrated', title: 'Known total without ratings', genres: ['Action'], themes: [], year: 2026, studio: 'Fixture studio', cover: '', type: 'TV', communityScore: 8, episodeCount: 12, episodes: [],
    stats: { scoringVersion: 2, episodeCount: 12, retentionScore: 0, threeEpisodeHook: 0, worthFinishing: 0,
      ratingEvidence: { totalEpisodes: 12, ratedEpisodes: 0, limited: true, completion: 'unknown' } } }];
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const pick = page.locator('#recommendations-grid .recommendation-card').first();
  await pick.getByText('Ratings and evidence', { exact: true }).click();
  await expect(pick).not.toContainText('0/100');
  await expect(pick).toContainText('8.0/10');
  await expect(pick).toContainText('unavailable');
  const catalog = page.locator('#anime-grid .anime-card').first();
  await expect(catalog).not.toContainText('0/100');
  await expect(catalog).toContainText('N/A');
  await pick.locator('.recommendation-title').click();
  const detail = page.locator('#detail-modal');
  await expect(detail).not.toContainText('0/100');
  await expect(detail).toContainText('8.0/10');
  await expect(detail).toContainText('Episode rating data unavailable');
});


test('missing community and episode ratings remain unavailable in catalog and details', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rekonime.onboarding', 'completed'));
  const anime = [{ id: 'no-ratings', title: 'No ratings available', genres: ['Action'], themes: [], year: 2026, studio: 'Fixture studio', cover: '', type: 'TV', episodes: [] }];
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const card = page.locator('#anime-grid .anime-card').first();
  await expect(card).toContainText('Community Score (MAL)');
  await expect(card).toContainText('N/A');
  await expect(card).not.toContainText('0/100');
  await card.click();
  const detail = page.locator('#detail-modal');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('Community Score (MAL)');
  await expect(detail).toContainText('N/A');
  await expect(detail).not.toContainText('0/100');
});

test('zero-rated airing evidence retains limited and unknown-total qualifiers', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('rekonime.onboarding', 'completed'));
  const anime = [{ id: 'unrated-airing', title: 'Unrated airing title', genres: ['Action'], themes: [], year: 2026, studio: 'Fixture', cover: '', type: 'TV', communityScore: 8, episodes: [], stats: { scoringVersion: 2, retentionScore: 0, ratingEvidence: { totalEpisodes: null, ratedEpisodes: 0, limited: true, completion: 'airing' } } }];
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime } }));
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const pick = page.locator('#recommendations-grid .recommendation-card').first();
  await pick.getByText('Ratings and evidence', { exact: true }).click();
  for (const qualifier of ['unavailable', 'Limited data', 'total unknown', 'Provisional']) await expect(pick).toContainText(qualifier);
  await expect(pick).not.toContainText('0/100');
  await captureRatingLayouts(page, pick, testInfo);
  await pick.locator('.recommendation-title').click();
  for (const qualifier of ['unavailable', 'Limited data', 'total unknown', 'Provisional']) await expect(page.locator('#detail-modal')).toContainText(qualifier);
});

test('Because you watched names the full community metric and scale', async ({ page }, testInfo) => {
  const seed = { id: 'watched-seed', title: 'Watched seed', genres: ['Action'], themes: ['School'], year: 2026, studio: 'Fixture', cover: 'https://cdn.myanimelist.net/images/anime/1779/143584l.jpg', type: 'TV', communityScore: 8, episodes: [{ episode: 1, score: 4 }], stats: { scoringVersion: 2, retentionScore: 70, episodeCount: 12 } };
  const candidate = { ...seed, id: 'similar-candidate', title: 'Similar candidate', communityScore: 8.2 };
  await page.addInitScript(seed => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, entries: [{ id: seed.id, status: 'completed', progress: 12, updatedAt: 1000, snapshot: seed }] }));
  }, seed);
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime: [seed, candidate] } }));
  await page.goto('/');
  const card = page.locator('#byw-grid .recommendation-card').first();
  await expect(card).toBeVisible();
  await expect(card).toContainText('Community Score (MAL) 8.2/10');
  await captureRatingLayouts(page, card, testInfo);
});

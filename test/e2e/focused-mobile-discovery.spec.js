import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
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
  const card = page.locator('#recommendations-grid .recommendation-card').first();
  await card.scrollIntoViewIfNeeded();
  const artwork = await card.locator('.recommendation-media').boundingBox();
  expect(artwork.height).toBeLessThanOrEqual(180);
  await expect(card.locator('.recommendation-title')).toBeInViewport();
  await expect(card.getByRole('button', { name: /^Want to watch / })).toBeInViewport();
});

for (const width of [1280, 390]) {
  test(`Discovery visual inspection ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    await context.route('**/data/anime*.json*', route => route.fulfill({ json: { anime: [
      { id: 'long-title', title: 'A very long journey through another world with friends and an unexpectedly quiet afternoon', genres: ['Slice of Life'], themes: ['Iyashikei'], communityScore: 8, episodes: [] },
      { id: 'partial', title: 'Partial episode evidence', genres: ['Slice of Life'], themes: [], communityScore: 8, episodes: [{ episode: 7, score: 4 }], stats: { scoringVersion: 2, episodeCount: 7, retentionScore: 70, ratingEvidence: { totalEpisodes: null, ratedEpisodes: 1, limited: true, completion: 'airing' } } },
      { id: 'alternative', title: 'An alternative adventure', genres: ['Action'], themes: [], communityScore: 8, episodes: [] }
    ].map(item => ({ ...item, year: 2026, studio: 'Fixture studio', cover: '', type: 'TV' })) } }));
    const fresh = await context.newPage();
    await fresh.setViewportSize({ width, height: width === 390 ? 844 : 720 });
    await fresh.goto('/');
    await expect(fresh.locator('#discovery-garden')).toBeVisible();
    await fresh.screenshot({ path: testInfo.outputPath('fresh-visit.png'), animations: 'disabled' });
    await fresh.close();
    await page.goto('/');
    await expect(page.locator('.recommendation-title').first()).toBeVisible();
    const capture = async name => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path, animations: 'disabled' });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    await capture('landing');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('#discovery-garden')).toBeVisible();
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
    const reflow = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')].flatMap(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && (rect.right > innerWidth + 1 || rect.left < -1)
          ? [{ tag: element.tagName, id: element.id, class: element.className, left: rect.left, right: rect.right }]
          : [];
      })
    }));
    await testInfo.attach('page-reflow', { body: JSON.stringify(reflow, null, 2), contentType: 'application/json' });
    expect(reflow.scrollWidth, '200% text must not require horizontal page scrolling').toBeLessThanOrEqual(width);
    for (const control of [
      card.getByRole('button', { name: /^Want to watch / }),
      card.getByRole('button', { name: /^Skip for now/ }),
      page.getByRole('button', { name: 'Filter & sort', exact: true })
    ]) {
      await control.scrollIntoViewIfNeeded();
      const rect = await control.boundingBox();
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(width);
      await expect(control).toBeInViewport();
      await expect(control).toBeEnabled();
      await control.click({ trial: true });
    }
    await card.scrollIntoViewIfNeeded();
    const bounds = await card.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
  });
}

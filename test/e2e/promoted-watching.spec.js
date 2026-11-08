import { test, expect } from '@playwright/test';

const entries = [
  { id: 'older', status: 'watching', progress: 3, updatedAt: 1000, snapshot: { title: 'Older Watching title', stats: { episodeCount: 12 } } },
  { id: 'recent', status: 'watching', progress: 0, updatedAt: 2000, snapshot: { title: 'A recently updated Watching title with a long name and an unknown episode total' } },
  ...['planned', 'completed', 'dropped'].map((status, index) => ({ id: status, status, progress: 0, updatedAt: 3000 + index, snapshot: { title: `${status} title` } }))
].map(entry => ({ ...entry, snapshot: { id: entry.id, cover: '/favicon.svg', ...entry.snapshot } }));

async function openHome(page, saved = entries) {
  await page.addInitScript(saved => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
    if (!localStorage.getItem('rekonime.watchlist')) localStorage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, entries: saved }));
  }, saved);
  // The saved titles are deliberately absent from the catalog: exercise Snapshot fallback.
  await page.route('**/data/anime*.json*', route => route.fulfill({ json: { anime: [{ id: 'catalog', title: 'Catalog title', genres: ['Action'], themes: [], episodes: [] }] } }));
  await page.route('https://graphql.anilist.co', route => route.fulfill({ json: { data: { Page: { media: [] } } } }));
  await page.goto('/');
}

test('homepage promotes only the latest Watching entry and View all retains the full Watchlist', async ({ page }) => {
  await openHome(page);
  const section = page.locator('#continue-watching-section');
  await expect(section.locator('article')).toHaveCount(1);
  await expect(section).toContainText(entries[1].snapshot.title);
  await section.getByRole('link', { name: 'View all', exact: true }).click();
  await expect(page).toHaveURL(/watchlist\.html/);
  await expect(page.locator('#watchlist-grid input[type="number"]')).toHaveCount(5);
});

test('homepage omits the promoted section without Watching entries', async ({ page }) => {
  await openHome(page, entries.filter(entry => entry.status !== 'watching'));
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  await expect(page.locator('#continue-watching-section')).toBeHidden();
});

for (const scenario of ['zero-multiple', 'positive-multiple', 'positive-single']) {
  test(`promoted Watching layout: ${scenario} on desktop/mobile in both themes`, async ({ page }) => {
    const saved = scenario === 'positive-single' ? [entries[0]] : entries.map(entry => entry.id === 'recent' && scenario === 'positive-multiple' ? { ...entry, progress: 2 } : entry);
    await openHome(page, saved);
    const section = page.locator('#continue-watching-section');
    await expect(section.locator('article')).toHaveCount(1);
    await expect(section).toContainText(scenario === 'positive-single' ? '3 / 12 episodes watched' : `${scenario === 'zero-multiple' ? 0 : 2} episodes watched · total unknown`);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
      for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
        await section.scrollIntoViewIfNeeded();
        const box = await section.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        await section.screenshot({ path: `.scratch/ui-design/evidence/04/${scenario}-${width}-${theme}.png` });
        await page.screenshot({ path: `.scratch/ui-design/evidence/04/${scenario}-${width}-${theme}-page.png` });
      }
    }
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await section.scrollIntoViewIfNeeded();
    await section.screenshot({ path: `.scratch/ui-design/evidence/04/${scenario}-390-light-text200.png` });
    const sectionBox = await section.boundingBox();
    expect(sectionBox.x + sectionBox.width).toBeLessThanOrEqual(390);
  });
}

test('zero progress starts watching and recording progress continues watching without changing status', async ({ page }) => {
  await openHome(page);
  const section = page.locator('#continue-watching-section');
  await expect(section.getByRole('heading', { name: 'Start watching', exact: true })).toBeVisible();
  await expect(section).toContainText('0 episodes watched · total unknown');
  await section.getByRole('button', { name: `Mark episode 1 of ${entries[1].snapshot.title} watched`, exact: true }).click();
  await expect(section.getByRole('heading', { name: 'Continue watching', exact: true })).toBeVisible();
  await expect(section).toContainText('1 episode watched · total unknown');
  await page.reload();
  await expect(section).toContainText('1 episode watched · total unknown');
  await section.getByRole('link', { name: 'View all', exact: true }).click();
  const card = page.locator('#watchlist-grid .anime-card').filter({ hasText: entries[1].snapshot.title });
  await expect(card.locator('input[type="number"]')).toHaveValue('1');
  await expect(card.locator('select')).toHaveValue('watching');
});

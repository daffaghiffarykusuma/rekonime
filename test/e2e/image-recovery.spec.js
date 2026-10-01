import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const anime = JSON.parse(readFileSync(new URL('../../data/anime.preview.json', import.meta.url), 'utf8')).anime[0];

const expectDecodedCovers = async (page, selector) => {
  const images = page.locator(selector);
  expect(await images.count()).toBeGreaterThan(0);
  await expect.poll(() => images.evaluateAll(elements => {
    // Deferred catalog batches may add lazy covers while this assertion waits.
    elements.forEach(img => { img.loading = 'eager'; });
    return elements.filter(img => !img.complete || img.naturalWidth === 0 || !img.src.startsWith('data:image/svg+xml,'))
      .map(img => ({ title: img.alt, src: img.src, complete: img.complete }));
  })).toEqual([]);
};

for (const cachedProxy of [false, true]) {
  test(`covers recover on home, detail and watchlist when image hosts fail (${cachedProxy ? 'cached proxy' : 'first visit'})`, async ({ page }) => {
    if (cachedProxy) await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(({ anime, cachedProxy }) => {
      localStorage.setItem('rekonime.onboarding', 'completed');
      localStorage.setItem('rekonime.shortcutsAcknowledged', 'true');
      if (cachedProxy) {
        localStorage.setItem('rekonime.imageProxyStatus', JSON.stringify({ ok: true, checkedAt: Date.now() }));
      } else {
        localStorage.removeItem('rekonime.imageProxyStatus');
      }
      localStorage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, entries: [
        { id: anime.id, status: 'planned', progress: 0, updatedAt: 1000, snapshot: anime }
      ] }));
    }, { anime, cachedProxy });
    await page.route(/^https:\/\//, route => route.abort());

    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
    await expectDecodedCovers(page, 'img[data-fallback-src]');

    await page.locator('#anime-grid .anime-card').first().click();
    await expect(page.locator('.detail-cover')).toBeVisible();
    await expectDecodedCovers(page, '.detail-cover');

    await page.goto('/watchlist.html');
    await expect(page.locator('#watchlist-grid .card-cover')).toBeVisible();
    await expectDecodedCovers(page, '#watchlist-grid .card-cover');
  });
}

test('a failed proxy retries the original cover before using a placeholder', async ({ page }) => {
  const cover = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="green"/></svg>';
  await page.addInitScript(() => {
    localStorage.setItem('rekonime.onboarding', 'completed');
    localStorage.setItem('rekonime.imageProxyStatus', JSON.stringify({ ok: true, checkedAt: Date.now() }));
  });
  let proxyRequests = 0;
  await page.route(/^https:\/\//, async route => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'images.weserv.nl') {
      proxyRequests++;
      return route.abort();
    }
    if (host === 'cdn.myanimelist.net') {
      return route.fulfill({ contentType: 'image/svg+xml', body: cover });
    }
    return route.abort();
  });
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.catalogReady === 'true');
  const images = page.locator('#anime-grid .card-cover');
  await expect(images.first()).toBeVisible();
  await expect.poll(() => images.evaluateAll(elements => {
    elements.forEach(img => { img.loading = 'eager'; });
    return elements.filter(img => !img.complete || img.naturalWidth === 0 || new URL(img.src).hostname !== 'cdn.myanimelist.net')
      .map(img => ({ title: img.alt, src: img.src, complete: img.complete }));
  })).toEqual([]);
  expect(proxyRequests).toBeGreaterThan(0);
});

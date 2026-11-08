import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const width of [390, 1280]) {
  for (const theme of ['dark', 'light']) {
    for (const scale of [100, 200]) {
      test(`Watchlist reflows with actionable controls at ${width}px ${theme} ${scale}% text`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 720 });
        const anime = JSON.parse(readFileSync('data/anime.full.json', 'utf8')).anime.find(item => item.episodeCount > 4 && item.malId);
        await page.addInitScript(({ anime, theme }) => {
          localStorage.setItem('rekonime.theme', theme);
          if (!localStorage.getItem('rekonime.watchlist')) localStorage.setItem('rekonime.watchlist', JSON.stringify({ version: 1, entries: [{ id: anime.id, status: 'watching', progress: 3, updatedAt: 1000, snapshot: anime }] }));
        }, { anime, theme });
        await page.route('https://graphql.anilist.co/**', route => route.fulfill({ json: { data: { Page: { media: [] } } } }));
        await page.goto('/watchlist.html');
        const progress = page.locator('#watchlist-grid input[type="number"]');
        await expect(progress).toHaveValue('3');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, scale);
        await page.screenshot({ path: testInfo.outputPath('closed.png'), fullPage: true });
        const geometry = await page.evaluate(() => ({
          width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
          overflowing: [...document.querySelectorAll('body *')].map(element => {
            const box = element.getBoundingClientRect();
            return { tag: element.tagName, class: element.className, x: box.x, right: box.right, width: box.width };
          }).filter(box => box.width && box.right > innerWidth + 1)
        }));
        await testInfo.attach('geometry', { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' });
        expect(geometry.scrollWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(width);
        const withinPage = async locator => {
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox();
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        };
        await withinPage(progress);
        for (const [name, value] of [['Increase watched episodes', '4'], ['Decrease watched episodes', '3']]) {
          const button = page.getByRole('button', { name, exact: true });
          await withinPage(button);
          await button.click();
          await expect(progress).toHaveValue(value);
        }
        const status = page.getByRole('combobox', { name: `Your watch status for ${anime.title}`, exact: true });
        await withinPage(status);
        await status.selectOption('planned');
        await expect(progress).toBeHidden();
        await status.selectOption('watching');
        await expect(progress).toHaveValue('0');
        await progress.fill('4');
        await progress.press('Tab');
        await expect(progress).toHaveValue('4');
        await page.reload();
        await expect(progress).toHaveValue('4');
        await page.evaluate(scale => { document.documentElement.style.fontSize = `${scale}%`; }, scale);
        const watching = page.getByRole('tab', { name: /Watching/ });
        await withinPage(watching);
        await watching.click();
        await expect(progress).toHaveValue('4');
        const manage = page.getByText('Manage data', { exact: true });
        await withinPage(manage);
        await manage.focus();
        await page.keyboard.press('Enter');
        for (const name of ['Export backup', 'Restore backup', 'Import MAL progress']) {
          const button = page.getByRole('button', { name, exact: true });
          await withinPage(button);
          await button.click({ trial: true });
        }
        await page.screenshot({ path: testInfo.outputPath('open.png'), fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export backup', exact: true }).click();
        expect(JSON.parse(readFileSync(await (await download).path(), 'utf8')).watchlist[0].progress).toBe(4);
      });
    }
  }
}

import { expect, test } from '@playwright/test';

const post = 'https://www.reddit.com/r/omarchy/comments/1wrjlkh/introducing_omaphoto_photo_editor/';
const title = 'Introducing OmaPhoto | Photo Editor';
const stream = 'https://v.redd.it/tma4eya482sh1/HLSPlaylist.m3u8';

for (const width of [390, 1280]) {
  test(`shows a Reddit video and linked title at ${width}px`, async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({
      json: {
        items: [{ id: 1, feed_id: 4, link: post, title, text: '<img src="https://share.redd.it/preview/post/1wrjlkh">' }],
        next_cursor: '', has_more: false, sync_cursor: 'sync',
      },
    }));
    await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({
      json: { upserted: [], deleted_ids: [], next_cursor: 'sync', has_more: false },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: { url: post, title, description: null, image: null, video: stream, siteName: 'Reddit', type: 'video', providerData: null },
    }));
    await page.route(stream, () => new Promise(() => {}));
    await page.addInitScript(() => {
      localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
    });
    await page.setViewportSize({ width, height: 844 });
    const streamRequest = page.waitForRequest(stream);
    await page.goto('/reader');
    const video = page.locator('.reader-card--reddit video');
    await expect(video).toBeVisible();
    await streamRequest;
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('link', { name: title, exact: true })).toHaveAttribute('href', post);

    if (width > 640) {
      const regularTitleSize = await page.getByRole('heading', { name: title })
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
      await expect(page.locator('.reader__item')).toHaveClass(/reader__item--fullscreen/);
      const fullscreenTitleSize = await page.getByRole('heading', { name: title })
        .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      expect(fullscreenTitleSize).toBeGreaterThan(regularTitleSize);
      const videoBox = await video.boundingBox();
      const titleBox = await page.getByRole('heading', { name: title }).boundingBox();
      const actionsBox = await page.locator('.reader__actions').boundingBox();
      expect(titleBox!.y - videoBox!.y - videoBox!.height).toBeGreaterThanOrEqual(0);
      expect(titleBox!.y - videoBox!.y - videoBox!.height).toBeLessThanOrEqual(24);
      expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(actionsBox!.y);
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(844);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

import { expect, test } from '@playwright/test';

test.describe('TikTok player on iPad-sized readers', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 20,
          feed_id: 4,
          link: 'https://www.tiktok.com/@creator/video/123',
          title: 'Short video',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://www.tiktok.com/player/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>TikTok player</title>',
    }));
    await page.route('**/api/bff/tiktok-comments?**', (route) => route.fulfill({
      json: {
        comments: [],
        description: null,
        authorName: null,
        authorAvatar: null,
      },
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('stays visible in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const box = await player.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(600);
    expect(box!.height).toBeGreaterThan(1_100);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024);
  });

  test('uses the available height in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const box = await player.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(440);
    expect(box!.height).toBeGreaterThan(780);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
  });

  test('does not shrink when comments are shown', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const collapsedBox = await player.boundingBox();

    await page.getByRole('button', { name: 'Show comments' }).click();
    await expect(page.getByRole('button', { name: 'Hide comments' })).toBeVisible();
    const expandedBox = await player.boundingBox();

    expect(collapsedBox).not.toBeNull();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.width).toBeGreaterThanOrEqual(collapsedBox!.width - 1);
    expect(expandedBox!.height).toBeGreaterThanOrEqual(collapsedBox!.height - 1);
  });
});

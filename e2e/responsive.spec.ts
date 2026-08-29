import { expect, test } from '@playwright/test';

test('authenticated feed shell fits the target viewport', async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Feed sources' })).toBeVisible();
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
});

test('collapsed TikTok controls stay beside the video in iPad landscape fullscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 683 });
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
  await page.route('**/bff/tiktok-comments?**', (route) => route.fulfill({
    json: {
      comments: [],
      description: null,
      creatorName: null,
      creatorAvatarUrl: null,
    },
  }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });
  await page.goto('/reader');

  const player = page.locator('.reader-card__preview--tiktok');
  await expect(player).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.readerFullscreen = 'true';
    document.querySelector<HTMLElement>('main')!.dataset.readerFullscreen = 'true';
    document.dispatchEvent(new Event('readerfullscreenchange'));
  });
  await expect(page.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();

  const layout = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>('.reader-card--tiktok')!.getBoundingClientRect();
    const preview = document.querySelector<HTMLElement>('.reader-card__preview--tiktok')!.getBoundingClientRect();
    const actions = document.querySelector<HTMLElement>('.tiktok-comments__actions')!.getBoundingClientRect();
    return {
      actionsLeft: actions.left,
      actionsRight: actions.right,
      previewRight: preview.right,
      cardCenter: card.left + card.width / 2,
      viewportCenter: window.innerWidth / 2,
      viewportWidth: window.innerWidth,
    };
  });

  expect(layout.actionsLeft).toBeGreaterThanOrEqual(layout.previewRight + 8);
  expect(layout.actionsRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(Math.abs(layout.cardCenter - layout.viewportCenter)).toBeLessThanOrEqual(1);
});

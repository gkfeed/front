import { expect, test } from '@playwright/test';

test('VK media and copy use more of the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone');

  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
    json: {
      items: [{
        id: 20,
        feed_id: 4,
        link: 'https://vk.com/wall-123_456',
        title: 'VK community',
        text: '<img src="https://example.com/vk-card.jpg"><br>Story copy',
      }],
      next_cursor: null,
    },
  }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({
    json: {
      url: 'https://vk.com/wall-123_456',
      title: 'VK community',
      description: 'Story copy',
      image: 'https://example.com/vk-card.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    },
  }));
  await page.route('https://example.com/vk-card.jpg', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#07f"/></svg>',
  }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });

  await page.goto('/reader');
  const card = page.locator('.reader-card--vk');
  await expect(card.locator('.reader-card__preview img')).toBeVisible();
  await expect(card.locator('.reader-card__copy')).toContainText('Story copy');

  const bounds = await card.evaluate((vkCard) => {
    const item = vkCard.closest<HTMLElement>('.reader__item')!;
    const media = vkCard.querySelector<HTMLElement>('.reader-card__preview')!;
    const copy = vkCard.querySelector<HTMLElement>('.reader-card__copy')!;
    const itemBox = item.getBoundingClientRect();
    const cardBox = vkCard.getBoundingClientRect();
    const mediaBox = media.getBoundingClientRect();
    const copyBox = copy.getBoundingClientRect();
    return {
      itemLeft: itemBox.left,
      itemRight: window.innerWidth - itemBox.right,
      cardLeft: cardBox.left,
      cardRight: window.innerWidth - cardBox.right,
      mediaLeft: mediaBox.left,
      mediaRight: window.innerWidth - mediaBox.right,
      copyLeft: copyBox.left,
      copyRight: window.innerWidth - copyBox.right,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });

  expect(bounds.itemLeft).toBe(12);
  expect(bounds.itemRight).toBe(12);
  expect(bounds.cardLeft).toBe(12);
  expect(bounds.cardRight).toBe(12);
  expect(bounds.mediaLeft).toBe(12);
  expect(bounds.mediaRight).toBe(12);
  expect(bounds.copyLeft).toBe(12);
  expect(bounds.copyRight).toBe(12);
  expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
});

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

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
    await page.route('https://example.com/poster.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#a6e3a1"/></svg>',
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
  });

  test('stays visible in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const box = await player.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(550);
    expect(box!.width).toBeLessThan(600);
    expect(box!.height).toBeGreaterThan(1_000);
    expect(box!.height).toBeLessThan(1_050);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024);

    const commentsButtonBox = await page.getByRole('button', { name: 'Show comments' }).boundingBox();
    expect(commentsButtonBox).not.toBeNull();
    expect(commentsButtonBox!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
    expect(commentsButtonBox!.x + commentsButtonBox!.width).toBeLessThanOrEqual(1024);
  });

  test('automatically opens TikTok in fullscreen on mobile with a copy-link action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reader');

    await expect(page.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More review actions' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scroll view' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show comments' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open original' })).toHaveCount(0);
  });

  test('stays out of fullscreen after leaving TikTok fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reader');

    const navbar = page.locator('.nav');
    const fullscreenButton = page.getByRole('button', { name: 'Exit Reader fullscreen' });
    await expect(navbar).toBeHidden();
    await expect(fullscreenButton).toBeVisible();
    await fullscreenButton.click();
    await expect(navbar).toBeVisible();
    await expect(page.locator('#main').getByRole('button', {
      name: 'Open Reader fullscreen',
    })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-reader-fullscreen', 'true');

    // A viewport change must not undo an explicit exit for the current TikTok.
    await page.setViewportSize({ width: 700, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#main').getByRole('button', {
      name: 'Open Reader fullscreen',
    })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-reader-fullscreen', 'true');
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

  test('uses free horizontal space for comments in a tall desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1224, height: 1401 });
    await page.goto('/reader');

    await page.getByRole('button', { name: 'Show comments' }).click();
    const commentsBox = await page.locator('.tiktok-comments').boundingBox();

    expect(commentsBox).not.toBeNull();
    expect(commentsBox!.width).toBeGreaterThanOrEqual(420);
    expect(commentsBox!.width).toBeLessThanOrEqual(620);
  });

  test('makes the TikTok player larger in fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    await page.getByRole('button', { name: 'Show comments' }).click();
    const regularBox = await player.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('.reader__fullscreen-toolbar').getByRole('button', {
      name: 'Exit Reader fullscreen',
    })).toBeVisible();
    const fullscreenBox = await player.boundingBox();

    expect(regularBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox!.width).toBeGreaterThan(regularBox!.width);
    expect(fullscreenBox!.height).toBeGreaterThan(regularBox!.height);
    expect(Math.abs(fullscreenBox!.width * 16 / 9 - fullscreenBox!.height)).toBeLessThan(1);
  });

  test('keeps the TikTok comments rail wide in fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/reader');

    await page.getByRole('button', { name: 'Show comments' }).click();
    const comments = page.locator('.tiktok-comments');
    const regularBox = await comments.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('.reader__fullscreen-toolbar').getByRole('button', {
      name: 'Exit Reader fullscreen',
    })).toBeVisible();
    const fullscreenBox = await comments.boundingBox();

    expect(regularBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox!.width).toBeGreaterThanOrEqual(420);
    expect(fullscreenBox!.width).toBeLessThanOrEqual(620);
  });

  test('does not add vertical bars around fullscreen feed images', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 22,
          feed_id: 4,
          link: 'https://www.reddit.com/r/opensource/comments/abc/event_dispatch/',
          title: 'Event Dispatch',
          text: '<img src="https://example.com/reddit-card.jpg">',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/reddit-card.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#11111b"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    await expect(page.locator('.reader-card__preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    const bounds = await page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>('.reader-card__preview')?.getBoundingClientRect();
      const image = document.querySelector<HTMLImageElement>('.reader-card__preview img')?.getBoundingClientRect();
      return {
        previewHeight: preview?.height ?? 0,
        imageHeight: image?.height ?? 0,
        actionsBottom: document.querySelector<HTMLElement>('.reader__actions')?.getBoundingClientRect().bottom ?? 0,
        viewportHeight: window.innerHeight,
      };
    });

    expect(Math.abs(bounds.previewHeight - bounds.imageHeight)).toBeLessThan(3);
    expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.viewportHeight);
  });

  test('keeps VK image previews visible in their media-first card', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 23,
          feed_id: 567,
          link: 'https://vk.com/wall-123_456',
          title: 'Рифмы и Панчи',
          text: '<img src="https://example.com/vk-card.jpg"><br>Post description',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/vk-card.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#447bba"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const preview = page.locator('.reader-card--vk .reader-card__preview');
    await expect(preview).toBeVisible();
    await expect(page.locator('.reader-card--vk .reader-card__copy')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Open original' })).toHaveCount(0);
    const box = await preview.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(Math.abs(box!.width / box!.height - 16 / 9)).toBeLessThan(0.01);
  });

  test('keeps regular image cards and review actions inside fullscreen', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 21,
          feed_id: 4,
          link: 'https://example.com/poster.jpg',
          title: 'A long image title that should wrap inside the fullscreen reader',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/poster.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1000" viewBox="0 0 900 1000"><rect width="900" height="1000" fill="#a6e3a1"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    await expect(page.locator('.reader-card__preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('#main').getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();

    const bounds = await page.evaluate(() => {
      const item = document.querySelector<HTMLElement>('.reader__item');
      const actions = document.querySelector<HTMLElement>('.reader__actions');
      const preview = document.querySelector<HTMLElement>('.reader-card__preview');
      const previewBox = preview?.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        itemRight: item?.getBoundingClientRect().right ?? 0,
        actionsRight: actions?.getBoundingClientRect().right ?? 0,
        itemLeft: item?.getBoundingClientRect().left ?? 0,
        actionsLeft: actions?.getBoundingClientRect().left ?? 0,
        itemWidth: item?.getBoundingClientRect().width ?? 0,
        actionsWidth: actions?.getBoundingClientRect().width ?? 0,
        cardWidth: document.querySelector<HTMLElement>('.reader-card')?.getBoundingClientRect().width ?? 0,
        previewWidth: previewBox?.width ?? 0,
        previewHeight: previewBox?.height ?? 0,
        imageWidth: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().width ?? 0,
        imageHeight: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().height ?? 0,
        imageLeft: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().left ?? 0,
        imageRight: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().right ?? 0,
        previewRight: previewBox?.right ?? 0,
        actionsBottom: actions?.getBoundingClientRect().bottom ?? 0,
        viewportHeight: window.innerHeight,
        previewCenter: previewBox ? previewBox.left + previewBox.width / 2 : 0,
      };
    });

    expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.itemRight).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.actionsRight).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(Math.abs(bounds.itemWidth - bounds.actionsWidth)).toBeLessThan(1);
    expect(Math.abs(bounds.itemLeft - bounds.actionsLeft)).toBeLessThan(1);
    expect(Math.abs(bounds.itemWidth - bounds.cardWidth)).toBeLessThan(1);
    expect(Math.abs(bounds.previewWidth - bounds.imageWidth)).toBeLessThan(3);
    expect(Math.abs(bounds.previewHeight - bounds.imageHeight)).toBeLessThan(3);
    expect(Math.abs(bounds.imageLeft - (bounds.previewRight - bounds.previewWidth))).toBeLessThan(2);
    expect(Math.abs(bounds.imageRight - bounds.previewRight)).toBeLessThan(2);
    expect(Math.abs(bounds.imageWidth / bounds.imageHeight - 9 / 10)).toBeLessThan(0.01);
    expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.viewportHeight);
    expect(Math.abs(bounds.previewCenter - bounds.viewportWidth / 2)).toBeLessThan(1);
  });

  test('reflows controls after rotating from landscape to portrait', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 1366 });

    await expect.poll(async () => (await player.boundingBox())?.width).toBeLessThan(600);
    const playerBox = await player.boundingBox();
    const commentsButtonBox = await page.getByRole('button', { name: 'Show comments' }).boundingBox();

    expect(playerBox).not.toBeNull();
    expect(commentsButtonBox).not.toBeNull();
    expect(commentsButtonBox!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height);
    expect(commentsButtonBox!.x + commentsButtonBox!.width).toBeLessThanOrEqual(1024);
  });
});

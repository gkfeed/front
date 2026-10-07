import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({
    json: { upserted: [], deleted_ids: [], next_cursor: 'sync', has_more: false },
  }));
});

test('plays a VK wall video without loading its iframe challenge in Reader fullscreen', async ({ page }) => {
  const post = 'https://vk.com/wall-182864292_1336279';
  const video = 'https://vk.ru/video_ext.php?oid=-182864292&id=456257584&hash=2ad8edc0b31dd0da';
  const poster = 'https://example.com/vk-video-poster.jpg';
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({
    json: {
      items: [{ id: 1, feed_id: 567, link: post, title: 'STREAM INSIDE', text: 'Post with a video attachment' }],
      next_cursor: '', has_more: false, sync_cursor: 'sync',
    },
  }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({
    json: {
      url: post,
      title: 'STREAM INSIDE. Пост со стены.',
      description: null,
      image: poster,
      video,
      siteName: 'ВКонтакте',
      type: 'article',
      providerData: null,
    },
  }));
  await page.route('**/bff/vk-video?**', () => new Promise(() => {}));
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
  });
  await page.setViewportSize({ width: 2048, height: 1152 });
  await page.goto('/reader');
  const player = page.locator('.reader-card--vk video');
  await expect(player).toHaveAttribute('src', `/bff/vk-video?url=${encodeURIComponent(video)}`);
  await expect(player).toHaveAttribute('poster', poster);
  await expect(page.locator('.reader-card--vk iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
  await expect(player).toBeVisible();
  const playerBox = await player.boundingBox();
  const actionsBox = await page.locator('.reader__actions').boundingBox();
  expect(playerBox!.height).toBeGreaterThan(300);
  expect(playerBox!.y + playerBox!.height).toBeLessThanOrEqual(actionsBox!.y);
});

test('loads HLS for the reported hockey recording instead of falling back to its poster', async ({ page }) => {
  const post = 'https://vk.com/wall-45277565_394438';
  const embed = 'https://vk.ru/video_ext.php?oid=-45277565&id=456244225&hash=33b5252bdb6e927212';
  const variant = `/bff/vk-video?url=${encodeURIComponent('https://vkvd653.okcdn.ru/expires/123/sig/signed/video/')}`;
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({
    json: {
      items: [{ id: 1, feed_id: 567, link: post, title: '36 студия', text: 'Вашингтон - Каролина' }],
      next_cursor: '', has_more: false, sync_cursor: 'sync',
    },
  }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({
    json: { url: post, title: '36 студия', description: null, image: 'https://example.com/hockey.jpg',
      video: embed, siteName: 'VK', type: 'video.other', providerData: null },
  }));
  await page.route('**/bff/vk-video?**', (route) => {
    if (new URL(route.request().url()).searchParams.get('url') === embed) {
      return route.fulfill({
        contentType: 'application/vnd.apple.mpegurl',
        body: `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=1280x720\n${variant}\n`,
      });
    }
    return new Promise(() => {});
  });
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
  });

  const variantRequest = page.waitForRequest((request) => request.url().endsWith(variant));
  await page.goto('/reader');
  await variantRequest;
  await expect(page.locator('.reader-card--vk video')).toBeVisible();
  await expect(page.locator('.reader-card--vk video')).toHaveAttribute('poster', 'https://example.com/hockey.jpg');
  await expect(page.locator('.reader-card--vk iframe, .reader-card--vk a img')).toHaveCount(0);
});

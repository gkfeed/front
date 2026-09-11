import { expect, test } from '@playwright/test';

test('plays a VK wall video without loading its iframe challenge in Reader fullscreen', async ({ page }) => {
  const post = 'https://vk.com/wall-182864292_1336279';
  const video = 'https://vk.ru/video_ext.php?oid=-182864292&id=456257584&hash=2ad8edc0b31dd0da';
  const poster = 'https://example.com/vk-video-poster.jpg';
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
    json: {
      items: [{ id: 1, feed_id: 567, link: post, title: 'STREAM INSIDE', text: 'Post with a video attachment' }],
      next_cursor: null,
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

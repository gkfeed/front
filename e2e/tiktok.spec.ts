import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({
    json: { upserted: [], deleted_ids: [], next_cursor: 'sync', has_more: false },
  }));
});

test('TikTok player preference selects preview, controls speed, and reports media errors', async ({ page }) => {
  let playbackRequests = 0;
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
    items: [{ id: 20, feed_id: 4, link: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok test', text: '' }],
    next_cursor: '', has_more: false, sync_cursor: 'sync',
  } }));
  await page.route('**/bff/tiktok-comments?**', (route) => route.fulfill({ json: {
    comments: [], description: null, creatorName: null, creatorAvatarUrl: null,
  } }));
  await page.route('**/bff/tiktok-playback?**', (route) => {
    playbackRequests += 1;
    return route.fulfill({ json: { videoUrl: 'https://v.tiktokcdn.com/test.mp4' } });
  });
  await page.route('https://www.tiktok.com/player/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>TikTok embed</p>' }));
  // Keep media pending; actual clock acceleration was checked separately with the supplied real post.
  await page.route('**/bff/tiktok-media?**', async (route) => {
    await new Promise<void>((resolve) => page.once('close', () => resolve()));
    await route.abort().catch(() => undefined);
  });
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
  });
  await page.goto('/reader');
  await expect(page.locator('iframe[src*="tiktok.com/player"]')).toHaveCount(1);
  expect(playbackRequests).toBe(0);
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Preview', exact: true }).click();
  await page.getByRole('link', { name: 'Reader' }).click();
  const video = page.locator('video');
  await expect(video).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveCount(0);
  await video.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, 'duration', { configurable: true, value: 167 });
    element.dispatchEvent(new Event('loadedmetadata'));
    element.dispatchEvent(new Event('loadeddata'));
  });
  await page.locator('.reader-card__preview--tiktok').hover();
  const speed = page.getByRole('button', { name: 'Double playback speed' });
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await expect(video).toHaveJSProperty('playbackRate', 2);
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'false');
  await expect(video).toHaveJSProperty('playbackRate', 1);
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await expect(video).toHaveJSProperty('playbackRate', 2);
  await video.evaluate((element) => element.dispatchEvent(new Event('error')));
  await expect(page.getByText('This TikTok is unavailable in the preview.')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(video).toHaveCount(0);
  await expect(speed).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(
    localStorage.getItem('gkfeed.pluginSettings.tiktok.v1') ?? '{}',
  ).playbackMode)).toBe('preview');
});

test('mobile comments open and close while the unavailable preview shows the creator', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
    items: [{ id: 21, feed_id: 4, link: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok test', text: '' }],
    next_cursor: '', has_more: false, sync_cursor: 'sync',
  } }));
  await page.route('**/bff/tiktok-playback?**', (route) => route.fulfill({ status: 422, json: { error: { code: 'tiktok_post_unavailable' } } }));
  await page.route('**/bff/tiktok-comments?**', (route) => route.fulfill({ json: {
    comments: [{ id: '1', text: 'Example comment', author: 'Viewer', username: 'viewer', avatarUrl: null }],
    description: null, creatorName: null, creatorAvatarUrl: null,
  } }));
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
    localStorage.setItem('gkfeed.pluginSettings.tiktok.v1', JSON.stringify({ playbackMode: 'preview' }));
  });
  await page.goto('/reader');
  await expect(page.getByText('This TikTok is unavailable in the preview.')).toBeVisible();
  await expect(page.locator('.reader-card__tiktok-author-name')).toHaveText('creator');
  await page.getByRole('button', { name: 'Show comments' }).click();
  const dialog = page.getByRole('dialog', { name: 'Comments' });
  await expect(dialog.getByText('Example comment')).toBeVisible();
  await dialog.getByRole('button', { name: 'Hide comments' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Show comments' })).toBeVisible();
});

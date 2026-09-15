import { expect, test } from '@playwright/test';

test('TikTok player preference selects preview, controls speed, and falls back to embed', async ({ page }) => {
  let playbackRequests = 0;
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({ json: {
    items: [{ id: 20, feed_id: 4, link: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok test', text: '' }],
    next_cursor: null,
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
  await page.route('https://v.tiktokcdn.com/test.mp4', async (route) => {
    await new Promise<void>((resolve) => page.once('close', () => resolve()));
    await route.abort().catch(() => undefined);
  });
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
  });
  await page.goto('/reader');
  await expect(page.locator('iframe[src*="tiktok.com/player"]')).toHaveCount(1);
  expect(playbackRequests).toBe(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('menuitemradio', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const video = page.locator('video');
  await expect(video).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveCount(0);
  await video.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, 'duration', { configurable: true, value: 167 });
    element.dispatchEvent(new Event('loadedmetadata'));
  });
  const speed = page.getByRole('button', { name: 'Double playback speed' });
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await expect(video).toHaveJSProperty('playbackRate', 2);
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'false');
  await expect(video).toHaveJSProperty('playbackRate', 1);
  await speed.click();
  await expect(speed).toHaveAttribute('aria-pressed', 'true');
  await expect(video).toHaveJSProperty('playbackRate', 2);
  await video.dispatchEvent('error');
  await expect(page.locator('iframe[src*="tiktok.com/player"]')).toHaveCount(1);
  await expect(video).toHaveCount(0);
  await expect(speed).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('gkfeed.tiktokPlaybackMode'))).toBe('preview');
});

import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('buffers story candidates from different sources before the first decision', async ({ page }) => {
  const video = await readFile('dev/reader-fixtures/assets/sample.webm');
  const started: string[] = [];
  const items = [[1204, 1], [1203, 1], [1202, 2], [1201, 2]].map(([id, feed_id]) => ({
    id, feed_id, title: `inst: source-${feed_id}`, link: `https://tempfile.org/story-${id}/download`, text: '',
  }));
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
    items, next_cursor: '', has_more: false, sync_cursor: 'sync',
  } }));
  await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({ json: {
    upserted: [], deleted_ids: [], next_cursor: 'sync', has_more: false,
  } }));
  await page.route('https://tempfile.org/**', (route) => {
    started.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'video/webm', body: video });
  });
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'story-prefetch-test', password: 'test' }));
  });

  await page.goto('/reader?view=review');
  await expect(page.locator('.reader-card video')).toHaveAttribute('src', 'https://tempfile.org/story-1204/download');
  await expect.poll(() => started.some((url) => url.includes('/story-1202/'))).toBe(true);
  await expect.poll(() => started.some((url) => url.includes('/story-1203/'))).toBe(true);
});

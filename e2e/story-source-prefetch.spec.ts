import { readFile } from 'node:fs/promises';
import { expect, test, type Page, type Request } from '@playwright/test';

async function mockReader(page: Page) {
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
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'story-prefetch-test', password: 'test' }));
  });
}

test('buffers story candidates from different sources before the first decision', async ({ page }) => {
  const video = await readFile('dev/reader-fixtures/assets/sample.webm');
  const started: string[] = [];
  await mockReader(page);
  await page.route('https://tempfile.org/**', (route) => {
    started.push(route.request().url());
    return route.fulfill({ status: 200, contentType: 'video/webm', body: video });
  });

  await page.goto('/reader?view=review');
  await expect(page.locator('.reader-card video')).toHaveAttribute('src', 'https://tempfile.org/story-1204/download');
  await expect.poll(() => started.some((url) => url.includes('/story-1202/'))).toBe(true);
  await expect.poll(() => started.some((url) => url.includes('/story-1203/'))).toBe(true);
});

test('does not cancel an in-flight story when it becomes visible', async ({ page }) => {
  const video = await readFile('dev/reader-fixtures/assets/sample.webm');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let prefetched: Request | undefined;
  const failed: Request[] = [];
  await mockReader(page);
  page.on('requestfailed', (request) => failed.push(request));
  await page.route('https://tempfile.org/**', async (route) => {
    if (route.request().url().includes('/story-1202/')) {
      prefetched ??= route.request();
      await gate;
    }
    await route.fulfill({ status: 200, contentType: 'video/webm', body: video }).catch(() => undefined);
  });

  try {
    await page.goto('/reader?view=review');
    await expect.poll(() => Boolean(prefetched)).toBe(true);
    await page.getByRole('button', { name: 'Keep', exact: true }).click();
    await expect(page.locator('.reader-card video')).toHaveAttribute('src', 'https://tempfile.org/story-1202/download');
    // Let the browser process cancellation if the prefetch element was removed.
    await page.waitForTimeout(100);
    expect(failed).not.toContain(prefetched);
    release();
    await expect(page.locator('.reader-card__preview--short-video')).toHaveAttribute('data-media-ready', 'true');
    const style = await page.locator('.reader-card video').evaluate((element) => ({
      opacity: getComputedStyle(element).opacity,
      transition: getComputedStyle(element).transitionDuration,
    }));
    expect(style).toEqual({ opacity: '1', transition: '0s' });
  } finally {
    release();
  }
});

import { expect, test } from '@playwright/test';

test('keeps large feed bodies out of React preloader performance entries while advancing', async ({ page }) => {
  const items = Array.from({ length: 30 }, (_, index) => ({
    id: 30 - index, feed_id: 1, link: `https://example.com/${index}`,
    title: `Memory item ${30 - index}`,
    text: index < 6 ? '' : `<img src="data:image/jpeg;base64,${String(index).padStart(2, '0')}${'A'.repeat(128 * 1024)}">`,
  }));
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
    items, next_cursor: '', has_more: false, sync_cursor: 'memory',
  } }));
  await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({ json: {
    upserted: [], deleted_ids: [], next_cursor: 'memory', has_more: false,
  } }));
  await page.route('**/api/v1/items/*', (route) => route.fulfill({ json: {} }));
  await page.route('**/bff/**', (route) => route.fulfill({ status: 422, json: {} }));
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'memory-test', password: 'synthetic' }));
  });
  await page.goto('/reader');
  await expect(page.getByRole('heading', { name: 'Memory item 30', exact: true })).toBeVisible();
  await page.evaluate(() => performance.clearMeasures());
  for (let id = 30; id > 25; id--) {
    await page.keyboard.press('d');
    await expect(page.getByRole('heading', { name: `Memory item ${id - 1}`, exact: true })).toBeVisible();
  }
  const entries = await page.evaluate(() => performance.getEntriesByType('measure')
    .filter((entry) => entry.name.includes('ReaderProviderPreloader'))
    .map((entry) => JSON.stringify((entry as PerformanceMeasure).detail).length));
  // Ensure React's development instrumentation ran, then bound what it retained.
  expect(entries.length).toBeGreaterThan(0);
  expect(Math.max(...entries)).toBeLessThan(8192);
});

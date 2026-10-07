import { expect, test } from '@playwright/test';

test('protects the standalone settings route', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeVisible();
});

test('keeps standalone Settings readable in the dark theme on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
    localStorage.setItem('gkfeed.theme', 'dark');
  });
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const page = document.querySelector('.settings-page')!;
    return {
      noOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      textMatchesPageInk: getComputedStyle(page).color === getComputedStyle(document.body).color,
    };
  })).toEqual({ noOverflow: true, textMatchesPageInk: true });
  await page.getByRole('checkbox', { name: 'TikTok', exact: true }).uncheck();
  await expect(page.getByRole('radio', { name: 'Preview', exact: true })).toBeDisabled();
});

test('syncs plugin and Reader preferences across tabs without retaining TikTok capabilities', async ({ page, context }) => {
  await context.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await context.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
    items: [{ id: 20, feed_id: 4, link: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok test', text: '' }], next_cursor: '', has_more: false, sync_cursor: 'sync',
  } }));
  await context.route('**/api/v2/items/changes?**', (route) => route.fulfill({ json: {
    upserted: [], deleted_ids: [], next_cursor: 'changes', has_more: false,
  } }));
  await context.route('**/bff/open-graph?**', (route) => route.fulfill({ json: {
    url: 'https://www.tiktok.com/@creator/video/123', title: 'TikTok test', description: null,
    image: null, video: null, type: null, siteName: null, providerData: null,
  } }));
  await context.route('https://www.tiktok.com/player/**', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Fixture player</p>' }));
  await context.addInitScript(() => localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' })));
  await page.goto('/settings');
  const reader = await context.newPage();
  await reader.setViewportSize({ width: 390, height: 844 });
  await reader.goto('/reader');
  await expect(reader.locator('iframe[src*="tiktok.com/player"]')).toHaveCount(1);
  await expect(reader.locator('html')).toHaveAttribute('data-reader-fullscreen', 'true');

  await page.getByRole('radio', { name: 'Hide TikTok items', exact: true }).click();
  await expect(reader.locator('.reader-card')).toHaveCount(0);
  await expect(reader.getByRole('heading', { name: 'You’re all caught up' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'TikTok', exact: true }).uncheck();
  await expect(reader.locator('.reader-card--short-video')).toHaveCount(0);
  await expect(reader.locator('iframe')).toHaveCount(0);
  await expect(reader.locator('html')).not.toHaveAttribute('data-reader-fullscreen', 'true');
  await expect(reader.getByRole('heading', { name: 'TikTok test' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gkfeed.pluginSettings.tiktok.v1')!).hideItems)).toBe(true);

  await page.getByRole('radio', { name: 'Scroll', exact: true }).click();
  await expect(reader.getByRole('region', { name: 'Scroll view' })).toBeVisible();
  await reader.goto('/reader?view=review');
  await expect(reader.getByRole('region', { name: 'Review view' })).toBeVisible();
  await expect(reader.locator('iframe')).toHaveCount(0);
  await reader.close();
});

test('prunes disabled Live candidates for every account from Settings without scanning', async ({ page }) => {
  let discoveries = 0;
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v2/items/sync?**', (route) => {
    discoveries += 1;
    return route.fulfill({ json: { items: [], next_cursor: '', has_more: false, sync_cursor: 'sync' } });
  });
  await page.addInitScript(() => localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' })));
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('gkfeed-live', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('catalogs', { keyPath: 'username' });
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const transaction = database.transaction('catalogs', 'readwrite');
      for (const username of ['automation', 'other-account']) {
        transaction.objectStore('catalogs').put({
          username, lastReconciledAt: Date.now(), newestItemId: 100, providerIds: ['twitch', 'hltv', 'onefootball'],
          candidates: ['twitch', 'hltv', 'onefootball'].map((providerId) => ({
            key: `${providerId}:1`, providerId, eventId: '1', deduplicationKey: `${providerId}:1`, feedOrder: 0,
            item: { id: 1, feedId: 1, link: 'https://example.com/event', title: 'Fixture', text: '' },
          })),
        });
      }
      transaction.oncomplete = () => resolve();
    });
    database.close();
    localStorage.setItem('gkfeed.youtube.playbackProgress', 'fixture-preserved');
  });
  for (const provider of ['Twitch', 'HLTV', 'OneFootball']) {
    await page.getByRole('checkbox', { name: provider, exact: true }).uncheck();
  }
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('gkfeed-live', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const values = await new Promise<Array<{ candidates: unknown[]; providerIds: string[] }>>((resolve) => {
      const request = database.transaction('catalogs', 'readonly').objectStore('catalogs').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return values.length === 2 && values.every((value) => value.candidates.length === 0 && value.providerIds.length === 0);
  })).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('gkfeed.youtube.playbackProgress'))).toBe('fixture-preserved');
  await page.getByRole('link', { name: 'Live', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open settings' })).toBeVisible();
  expect(discoveries).toBe(0);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open settings' })).toBeVisible();
  expect(discoveries).toBe(0);
});

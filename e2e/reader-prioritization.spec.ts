import { expect, test } from '@playwright/test';

for (const type of ['rezka', 'rezka:collection']) {
  test(`${type} Keep preserves the selected episode across rounds and reloads`, async ({ page }) => {
    let addEpisode = false;
    const item = (id: number, feedId: number, title: string) => ({
      id, feed_id: feedId, link: `https://example.com/episode/${id}`, title, text: '',
    });
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [
      { id: 5, title: 'Series', type, url: 'https://hdrezka.me/series/story.html' },
      { id: 6, title: 'Other source', type: 'web', url: 'https://example.com' },
    ] }));
    await page.route('**/api/v2/items/sync?**', (route) => route.fulfill({ json: {
      items: [item(14, 5, 'Selected episode'), item(13, 5, 'Next episode'), item(12, 6, 'Other story')],
      next_cursor: '', has_more: false, sync_cursor: 'initial',
    } }));
    await page.route('**/api/v2/items/changes?**', (route) => route.fulfill({ json: {
      upserted: addEpisode ? [item(15, 5, 'New episode')] : [],
      deleted_ids: [], next_cursor: 'latest', has_more: false,
    } }));
    await page.addInitScript(() => {
      localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
    });

    await page.goto('/reader');
    await expect(page.getByRole('heading', { name: 'Selected episode' })).toBeVisible();
    await page.getByRole('button', { name: /keep/i }).click();
    await expect(page.getByRole('heading', { name: 'Other story' })).toBeVisible();
    await page.getByRole('button', { name: /keep/i }).click();

    if (type === 'rezka:collection') {
      await expect(page.getByRole('heading', { name: 'Next episode' })).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: 'Selected episode' })).toBeVisible();
    addEpisode = true;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Selected episode' })).toBeVisible();
    await page.getByRole('button', { name: /keep/i }).click();
    await expect(page.getByRole('heading', { name: 'Other story' })).toBeVisible();
    await page.getByRole('button', { name: /keep/i }).click();
    await expect(page.getByRole('heading', { name: 'You’ve reviewed everything' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset kept items' }).click();
    await expect(page.getByRole('heading', { name: 'New episode' })).toBeVisible();
  });
}

import { expect, test } from '@playwright/test';

test('authenticated feed shell fits the target viewport', async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Feed sources' })).toBeVisible();
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
});

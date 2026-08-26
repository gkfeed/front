import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });
});

test('opens settings as a page and remembers the TikTok delivery mode', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Settings' }).click();

  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  await expect(page.locator('.theme-picker__panel')).toHaveCount(0);

  const brokerMode = page.getByRole('radio', { name: /Download through broker/ });
  await expect(brokerMode).toHaveAttribute('aria-checked', 'false');
  await brokerMode.click();
  await expect(brokerMode).toHaveAttribute('aria-checked', 'true');

  await page.reload();
  await expect(page.getByRole('radio', { name: /Download through broker/ }))
    .toHaveAttribute('aria-checked', 'true');
});

test('keeps the settings cards inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');

  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
});

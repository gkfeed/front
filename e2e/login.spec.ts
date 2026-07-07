import { expect, test } from '@playwright/test';

test('signs in with saved credentials', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/Sign in to GKFEED \| GKFEED/);
  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeVisible();

  await page.getByLabel('Username').fill('automation');
  await page.getByLabel('Password').fill('secret');
  await expect(page.getByText('Ready to save')).toBeVisible();

  await page.getByRole('button', { name: 'Save login' }).click();

  await expect(page.getByRole('heading', { name: 'Feed sources' })).toBeVisible();
});

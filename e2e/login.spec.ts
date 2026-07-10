import { expect, test } from '@playwright/test';

test('signs in with saved credentials', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(/Sign in to GKFEED \| GKFEED/);
  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeAttached();

  await page.getByLabel('Username').fill('automation');
  await page.getByLabel('Password').fill('secret');
  await expect(page.getByText('Ready to save')).toBeVisible();

  await page.getByRole('button', { name: 'Save login' }).click();

  await expect(page.getByRole('heading', { name: 'Feed sources' })).toBeVisible();
});

test('keeps the sign-in form readable and usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeAttached();

  const username = page.getByLabel('Username');
  const password = page.getByLabel('Password');
  const submit = page.getByRole('button', { name: 'Save login' });

  for (const control of [username, password, submit]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await submit.click();
  await expect(page.locator('#username-error')).toHaveText('Enter your username.');
  await expect(page.locator('#password-error')).toHaveText('Enter your password.');
});

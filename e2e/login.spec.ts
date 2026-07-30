import { expect, test, type Page, type Route } from '@playwright/test';

const CREDENTIALS = { username: 'automation', password: 'secret' };

async function mockFeedList(page: Page) {
  const authorizationHeaders: string[] = [];

  await page.route('**/api/v1/list', async (route: Route) => {
    authorizationHeaders.push(route.request().headers().authorization ?? '');
    await route.fulfill({ json: [] });
  });

  return authorizationHeaders;
}

async function clearSavedCredentials(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem('gkfeed.credentials');
  });
}

test('signs in with valid credentials', async ({ page }) => {
  const authorizationHeaders = await mockFeedList(page);
  await clearSavedCredentials(page);
  await page.goto('/login');

  await expect(page).toHaveTitle(/Sign in to GKFEED \| GKFEED/);
  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeAttached();

  await page.getByLabel('Username').fill(CREDENTIALS.username);
  await page.getByLabel('Password').fill(CREDENTIALS.password);
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();

  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Feed sources' })).toBeVisible();
  await expect.poll(() => authorizationHeaders.length).toBeGreaterThan(0);
  expect(authorizationHeaders).toEqual(
    expect.arrayContaining(['Basic YXV0b21hdGlvbjpzZWNyZXQ=']),
  );
});

test('keeps the sign-in form readable and usable on a narrow screen', async ({ page }) => {
  await mockFeedList(page);
  await clearSavedCredentials(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Sign in to GKFEED' })).toBeAttached();

  const username = page.getByLabel('Username');
  const password = page.getByLabel('Password');
  const submit = page.getByRole('button', { name: 'Sign in' });

  for (const control of [username, password, submit]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await expect(submit).toBeDisabled();
  await username.fill(CREDENTIALS.username);
  await password.fill(CREDENTIALS.password);
  await expect(submit).toBeEnabled();
});

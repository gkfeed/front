import { expect, test } from '@playwright/test';

test('frontend proxy reaches the real BFF HTTP boundary', async ({ page }) => {
  await page.goto('/login');

  const result = await page.evaluate(async () => {
    const response = await fetch('/api/bff/open-graph');
    return { status: response.status, body: await response.json() };
  });

  expect(result).toEqual({
    status: 400,
    body: { error: { code: 'missing_url', message: 'The url query parameter is required' } },
  });
});

import { expect, test } from '@playwright/test';

test('channel resolver returns permanent URLs through the real BFF', async ({ request }) => {
  const url = 'https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/streams';
  const response = await request.get('/bff/youtube-channel', { params: { url: `${url}/?si=share` } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ channelId: 'UC5TRrMsWLy7flttFTyS-bOA', url });
});

test('channel resolver rejects missing and non-channel input through the real BFF', async ({ request }) => {
  const missing = await request.get('/bff/youtube-channel');
  expect(missing.status()).toBe(400);
  expect(await missing.json()).toEqual({ error: { code: 'missing_url', message: 'The url query parameter is required' } });

  const invalid = await request.get('/bff/youtube-channel', { params: { url: 'https://example.com/@example' } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: { code: 'invalid_url', message: 'Invalid YouTube channel URL' } });
});

test('frontend proxy reaches the real BFF HTTP boundary', async ({ page }) => {
  await page.goto('/login');

  const result = await page.evaluate(async () => {
    const response = await fetch('/bff/open-graph');
    return { status: response.status, body: await response.json() };
  });

  expect(result).toEqual({
    status: 400,
    body: { error: { code: 'missing_url', message: 'The url query parameter is required' } },
  });
});

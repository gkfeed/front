import { expect, test } from '@playwright/test';

const ID = 'UC5TRrMsWLy7flttFTyS-bOA';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/bff/feed-type?**', (route) => route.fulfill({ json: { type: 'yt', confidence: 1 } }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({ json: {
    url: 'https://www.youtube.com/@sendependa_dio_games',
    title: 'Channel title', description: null, image: null, video: null, siteName: 'YouTube', type: null, providerData: null,
  } }));
  await page.addInitScript(() => {
    window.localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
  });
});

for (const tab of ['videos', 'shorts', 'streams']) {
  test(`saves a YouTube handle as a permanent channel URL with /${tab}`, async ({ page }) => {
    const saved: unknown[] = [];
    await page.route('**/api/v1/add', async (route) => {
      saved.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, body: '' });
    });
    await page.route('**/bff/youtube-channel?**', async (route) => {
      expect(new URL(route.request().url()).searchParams.get('url'))
        .toBe(`https://www.youtube.com/@sendependa_dio_games/${tab}`);
      await route.fulfill({ json: { channelId: ID, url: `https://www.youtube.com/channel/${ID}/${tab}` } });
    });
    await page.goto('/create');
    await page.getByLabel('URL', { exact: true }).fill(`https://www.youtube.com/@sendependa_dio_games/${tab}`);
    await expect(page.getByRole('button', { name: 'Type YouTube' })).toBeVisible();
    await page.getByLabel('Title', { exact: true }).fill('My games');
    await page.getByRole('button', { name: 'Add feed' }).click();
    await expect(page.getByText('Feed source saved.')).toBeVisible();
    expect(saved).toEqual([{ title: 'My games', type: 'yt', url: `https://www.youtube.com/channel/${ID}/${tab}` }]);
  });
}

test('keeps the form after failed resolution and saves a corrected permanent URL without another lookup', async ({ page }) => {
  const saved: unknown[] = [];
  let resolutions = 0;
  await page.route('**/api/v1/add', async (route) => {
    saved.push(route.request().postDataJSON());
    await route.fulfill({ status: 201, body: '' });
  });
  await page.route('**/bff/youtube-channel?**', async (route) => {
    resolutions += 1;
    await route.fulfill({ status: 502, json: { error: { code: 'upstream_error', message: 'The remote page returned HTTP 404' } } });
  });
  await page.goto('/create');
  const input = 'https://www.youtube.com/@sendependa_dio/videos';
  await page.getByLabel('URL', { exact: true }).fill(input);
  await expect(page.getByRole('button', { name: 'Type YouTube' })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('My games');
  await page.getByRole('button', { name: 'Add feed' }).click();
  await expect(page.getByText('Could not save feed source. Try again.')).toBeVisible();
  await expect(page.getByLabel('URL', { exact: true })).toHaveValue(input);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My games');
  expect(saved).toEqual([]);

  const permanent = `https://www.youtube.com/channel/${ID}/videos`;
  await page.getByLabel('URL', { exact: true }).fill(permanent);
  await expect(page.getByRole('button', { name: 'Type YouTube' })).toBeVisible();
  await page.getByRole('button', { name: 'Add feed' }).click();
  await expect(page.getByText('Feed source saved.')).toBeVisible();
  expect(resolutions).toBe(1);
  expect(saved).toEqual([{ title: 'My games', type: 'yt', url: permanent }]);
});

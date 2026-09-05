import { expect, test } from '@playwright/test';

test('shows Twitch and HLTV events from the signed-in feed history', async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
    json: {
      items: [
        {
          id: 20,
          feed_id: 4,
          link: 'https://www.twitch.tv/some_channel',
          title: 'some_channel: Tournament final',
          text: '',
        },
        {
          id: 10,
          feed_id: 5,
          link: 'https://www.hltv.org/matches/2397001/alpha-vs-bravo',
          title: 'Alpha vs Bravo',
          text: '',
        },
      ],
      next_cursor: null,
    },
  }));
  await page.route('**/bff/hltv-live?**', (route) => route.fulfill({
    json: { eventIds: ['2397001'] },
  }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({
    json: {
      url: 'https://www.hltv.org/matches/2397001/alpha-vs-bravo',
      title: 'Alpha vs Bravo',
      description: null,
      image: null,
      video: null,
      siteName: 'HLTV',
      type: null,
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          tournament: 'Test cup',
          teams: [{ name: 'Alpha', logo: null }, { name: 'Bravo', logo: null }],
          status: 'live',
          score: ['1', '0'],
          currentMap: { name: 'Mirage', score: ['8', '6'] },
          completedMaps: [],
          roundHistory: [],
          playerStats: null,
          teamSides: ['ct', 't'],
        },
      },
    },
  }));
  await page.route('https://static-cdn.jtvnw.net/previews-ttv/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="440" height="248"><rect width="440" height="248" fill="#9147ff"/></svg>',
  }));
  await page.route('https://player.twitch.tv/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Twitch player</title>',
  }));
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'gkfeed.credentials',
      JSON.stringify({ username: 'automation', password: 'secret' }),
    );
  });

  await page.goto('/live');

  await expect(page.getByRole('heading', { name: 'Streams' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Esports' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tournament final' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Alpha versus Bravo/ })).toBeVisible();
  await expect(page.getByText('Feed history checked: 2 items')).toBeVisible();

  await page.getByRole('button', { name: 'Play some_channel on Twitch' }).click();
  await expect(page.getByRole('dialog', { name: 'some_channel Twitch player' })).toBeVisible();
});

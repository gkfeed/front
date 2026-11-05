import { expect, test } from '@playwright/test';

test('shows a LiveBall match preview', async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({ json: {
    items: [{ id: 20, feed_id: 4, link: 'https://liveball.sx/match/1635710', title: 'РБ Лейпциг vs Манчестер Сити - Лига Чемпионов · Общий этап, 4 тур', text: '' }], next_cursor: null,
  } }));
  await page.route('**/bff/open-graph?**', (route) => route.fulfill({ json: {
    url: 'https://liveball.sx/match/1635710', title: null, description: null, image: null, video: null, siteName: 'LiveBall', type: null,
    providerData: { provider: 'liveball', snapshot: { competition: 'Лига Чемпионов · Общий этап, 4 тур', competitionLogo: null, teams: [
      { name: 'РБ Лейпциг', logo: 'https://cdn.lbs.pw/football/teams/173.png' },
      { name: 'Манчестер Сити', logo: 'https://cdn.lbs.pw/football/teams/50.png' },
    ], score: ['2', '3'], status: 'Матч окончен', normalizedStatus: 'over', startsAt: '2026-11-04T20:00:00.000Z' } },
  } }));
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' }));
    localStorage.setItem('gkfeed.theme', 'mocha');
  });
  await page.goto('/reader');
  await expect(page.getByText('РБ Лейпциг', { exact: true })).toBeVisible();
  await expect(page.getByText('Манчестер Сити', { exact: true })).toBeVisible();
  await expect(page.getByText('2 : 3', { exact: true })).toBeVisible();
  await expect(page.locator('.liveball-match__result .liveball-match__date')).toBeVisible();
  await expect(page.locator('.liveball-match__crest img')).toHaveCount(2);
  await expect(page.locator('.liveball-match')).toHaveAttribute('href', 'https://liveball.sx/match/1635710');
  await expect(page.getByRole('img', { name: 'LiveBall' })).toBeVisible();
});

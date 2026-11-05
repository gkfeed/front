import { expect, test } from '@playwright/test';

test('shows a LiveBall match preview', async ({ page }) => {
  await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/get_items?**', (route) => route.fulfill({ json: {
    items: [{ id: 20, feed_id: 4, link: 'https://liveball.sx/match/1635710', title: 'РБ Лейпциг vs Манчестер Сити - Лига Чемпионов · Общий этап, 4 тур', text: '' }], next_cursor: null,
  } }));
  await page.addInitScript(() => localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'automation', password: 'secret' })));
  await page.goto('/reader');
  await expect(page.getByText('РБ Лейпциг', { exact: true })).toBeVisible();
  await expect(page.getByText('Манчестер Сити', { exact: true })).toBeVisible();
});

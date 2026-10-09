import { expect, test } from '@playwright/test';
import { writeFile, unlink } from 'node:fs/promises';

test('opens an actual reader item without using saved credentials or remote APIs', async ({ page }) => {
  const remoteRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4300' || /^\/(api|bff)\//.test(url.pathname)) {
      remoteRequests.push(url.href);
    }
  });
  await page.addInitScript(() => {
    localStorage.setItem('gkfeed.credentials', JSON.stringify({ username: 'existing-user', password: 'existing-secret' }));
    localStorage.setItem('gkfeed.theme', 'dark');
    Object.defineProperty(window, 'originalStorage', { value: localStorage });
  });
  await page.goto('/reader?fixture=text&view=review');
  await expect(page).toHaveURL(/\/__verify\/text\/reader\?view=review$/);
  await expect(page.getByRole('heading', { name: 'Reader text fixture' })).toBeVisible();
  expect(await page.evaluate(() => {
    const original = (window as unknown as { originalStorage: Storage }).originalStorage;
    return { credentials: original.getItem('gkfeed.credentials'), theme: original.getItem('gkfeed.theme') };
  })).toEqual({ credentials: JSON.stringify({ username: 'existing-user', password: 'existing-secret' }), theme: 'dark' });
  await page.getByRole('link', { name: 'List', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open feed Fixture feed 1', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reader', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reader text fixture' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reader text fixture' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Reader text fixture' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reader text fixture' })).toBeVisible();
  expect(remoteRequests).toEqual([]);
});

test('renders a custom raw API item from a JSON file', async ({ page }) => {
  const name = `custom-${test.info().workerIndex}.local`;
  const path = `dev/reader-fixtures/${name}.json`;
  await writeFile(path, JSON.stringify({
    id: 90210, feed_id: 42, link: 'https://vk.com/wall-42_90210',
    title: 'A specific custom mock item', text: '<p>Custom body from a JSON file.</p>',
  }));
  try {
    await page.goto(`/__verify/${name}/reader`);
    await expect(page.getByRole('heading', { name: 'A specific custom mock item' })).toBeVisible();
    await expect(page.getByText('Custom body from a JSON file.', { exact: true })).toBeVisible();
  } finally {
    await unlink(path);
  }
});

test('fails visibly for a missing fixture instead of loading real data', async ({ page }) => {
  await page.goto('/__verify/does-not-exist/reader');
  await expect(page.getByRole('alert')).toHaveText('Reader fixture "does-not-exist" was not found.');
  await expect(page.getByRole('heading', { name: 'Reader', exact: true })).toHaveCount(0);
});

test('serves deterministic gallery and video assets', async ({ page }) => {
  await page.goto('/__verify/vk-gallery/reader');
  const gallery = page.locator('.reader-card__vk-carousel');
  const image = gallery.locator('img');
  await expect(image).toHaveAttribute('src', /square-1\.svg$/);
  await gallery.getByRole('button', { name: 'Next slide' }).click();
  await expect(image).toHaveAttribute('src', /square-2\.svg$/);
  await expect(gallery.getByText('2 / 3')).toBeVisible();
  await page.goto('/__verify/video/reader');
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
  expect(await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    return { width: media.videoWidth, height: media.videoHeight, duration: media.duration };
  }))
    .toEqual({ width: 480, height: 270, duration: 3 });
});

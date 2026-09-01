import { expect, test } from '@playwright/test';

test.describe('Reader item order', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [
          { id: 20, feed_id: 4, link: 'https://example.com/new', title: 'New item', text: '' },
          { id: 10, feed_id: 4, link: 'https://example.com/old', title: 'Old item', text: '' },
        ],
        next_cursor: null,
      },
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('switches between newest-first and oldest-first', async ({ page }) => {
    await page.goto('/reader');
    await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitemradio', { name: 'Oldest first' }).click();

    await expect(page).toHaveURL(/\/reader$/);
    await expect(page.getByRole('heading', { name: 'Old item' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Old item' })).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('menuitemradio', { name: 'Newest first' }).click();

    await expect(page).toHaveURL(/\/reader$/);
    await expect(page.getByRole('heading', { name: 'New item' })).toBeVisible();
  });
});

test.describe('Reader fullscreen with theater mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 19,
          feed_id: 4,
          link: 'https://www.youtube.com/watch?v=abc123xyz',
          title: 'Theater video',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://www.youtube.com/embed/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>YouTube player</title>',
    }));
    await page.route('https://i.ytimg.com/vi/**', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#cba6f7"/></svg>',
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('hides the Reader fullscreen control while theater mode is open', async ({ page }) => {
    await page.goto('/reader');
    const playVideo = page.getByRole('button', { name: 'Play video Theater video' });
    await expect(playVideo).toBeVisible();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    const exitFullscreen = page.locator('.reader__fullscreen-toolbar').getByRole('button', { name: 'Exit Reader fullscreen' });
    await expect(exitFullscreen).toBeVisible();

    await playVideo.click();
    await expect(page.getByRole('button', { name: 'Exit theater mode' })).toBeVisible();
    await expect(exitFullscreen).toBeHidden();
    await expectYoutubePlayerToBeSixteenByNine(page);

    await page.getByRole('button', { name: 'Exit theater mode' }).click();
    await expect(exitFullscreen).toBeVisible();
    await expectYoutubePlayerToBeSixteenByNine(page);
  });

  test('shows a fullscreen YouTube thumbnail without letterbox bars', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');
    const preview = page.locator('.reader-card--youtube .reader-card__preview');
    const image = preview.locator('img');
    await expect(image).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.dataset.readerFullscreen = 'true';
      document.querySelector<HTMLElement>('main')!.dataset.readerFullscreen = 'true';
      document.dispatchEvent(new Event('readerfullscreenchange'));
    });

    const previewBox = await preview.boundingBox();
    const imageBox = await image.boundingBox();
    const actionsBox = await page.locator('.reader__actions').boundingBox();
    expect(previewBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(Math.abs(previewBox!.width / previewBox!.height - 16 / 9)).toBeLessThan(0.01);
    expect(Math.abs(previewBox!.width - imageBox!.width)).toBeLessThan(2);
    expect(Math.abs(previewBox!.height - imageBox!.height)).toBeLessThan(2);
    expect(previewBox!.y + previewBox!.height).toBeLessThanOrEqual(actionsBox!.y);
  });
});

async function expectYoutubePlayerToBeSixteenByNine(page: import('@playwright/test').Page) {
  const preview = page.locator('.reader-card--youtube .reader-card__preview--player');
  const iframe = preview.locator('iframe');
  await expect(iframe).toBeVisible();
  const previewBox = await preview.boundingBox();
  const iframeBox = await iframe.boundingBox();
  expect(previewBox).not.toBeNull();
  expect(iframeBox).not.toBeNull();
  expect(Math.abs(previewBox!.width / previewBox!.height - 16 / 9)).toBeLessThan(0.01);
  expect(Math.abs(previewBox!.width - iframeBox!.width)).toBeLessThan(2);
  expect(Math.abs(previewBox!.height - iframeBox!.height)).toBeLessThan(2);
}

test.describe('Fullscreen player card flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 21,
          feed_id: 4,
          link: 'https://matreshka.tv/video/LHAN5jgduhC',
          title: 'Video title | Channel name',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://matreshka.tv/video/LHAN5jgduhC',
        title: 'Video title',
        description: null,
        image: 'https://example.com/player-poster.jpg',
        video: null,
        siteName: 'Matreshka',
        type: 'video',
        providerData: null,
      },
    }));
    await page.route('https://example.com/player-poster.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#89b4fa"/></svg>',
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('keeps a video preview next to its description', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reader');
    await expect(page.locator('.reader-card--matreshka img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    const gap = await page.evaluate(() => {
      const preview = document.querySelector('.reader-card--matreshka .reader-card__preview-trigger-wrap')
        ?.getBoundingClientRect();
      const copy = document.querySelector('.reader-card--matreshka .reader-card__copy')
        ?.getBoundingClientRect();
      return preview && copy ? copy.top - preview.bottom : null;
    });

    expect(gap).not.toBeNull();
    expect(gap!).toBeGreaterThanOrEqual(0);
    expect(gap!).toBeLessThanOrEqual(24);
  });
});

test.describe('Fullscreen text card flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 15,
          feed_id: 15,
          link: 'https://calnewport.com/war-with-ai-agents/',
          title: 'Are We at War with AI Agent “Civilizations”?',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://calnewport.com/war-with-ai-agents/',
        title: 'Are We at War with AI Agent “Civilizations”?',
        description: null,
        image: null,
        video: null,
        siteName: 'calnewport.com',
        type: 'article',
        providerData: null,
      },
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('keeps a card without media compact in fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1152 });
    await page.goto('/reader');
    await expect(page.getByRole('heading', {
      name: 'Are We at War with AI Agent “Civilizations”?',
    })).toBeVisible();
    await expect(page.locator('.reader-card__preview')).toHaveCount(0);

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('.reader__fullscreen-toolbar').getByRole('button', {
      name: 'Exit Reader fullscreen',
    })).toBeVisible();

    const bounds = await page.evaluate(() => {
      const item = document.querySelector<HTMLElement>('.reader__item')!.getBoundingClientRect();
      const card = document.querySelector<HTMLElement>('.reader-card')!.getBoundingClientRect();
      const actions = document.querySelector<HTMLElement>('.reader__actions')!.getBoundingClientRect();
      return {
        itemHeight: item.height,
        itemCenter: item.top + item.height / 2,
        cardHeight: card.height,
        cardActionsGap: actions.top - card.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    expect(bounds.cardHeight).toBeLessThanOrEqual(360);
    expect(bounds.itemHeight).toBeLessThan(bounds.viewportHeight * 0.6);
    expect(Math.abs(bounds.itemCenter - bounds.viewportHeight / 2)).toBeLessThanOrEqual(2);
    expect(bounds.cardActionsGap).toBeGreaterThanOrEqual(0);
    expect(bounds.cardActionsGap).toBeLessThanOrEqual(24);
  });
});

test.describe('TikTok player on iPad-sized readers', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/list', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 20,
          feed_id: 4,
          link: 'https://www.tiktok.com/@creator/video/123',
          title: 'Short video',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://www.tiktok.com/player/**', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>TikTok player</title>',
    }));
    await page.route('https://example.com/poster.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><rect width="1200" height="675" fill="#a6e3a1"/></svg>',
    }));
    await page.route('**/bff/tiktok-comments?**', (route) => route.fulfill({
      json: {
        comments: [],
        description: null,
        creatorName: null,
        creatorAvatarUrl: null,
      },
    }));
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'gkfeed.credentials',
        JSON.stringify({ username: 'automation', password: 'secret' }),
      );
    });
  });

  test('stays visible in portrait', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const box = await player.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(550);
    expect(box!.width).toBeLessThan(600);
    expect(box!.height).toBeGreaterThan(1_000);
    expect(box!.height).toBeLessThan(1_050);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024);

    const commentsButtonBox = await page.getByRole('button', { name: 'Show comments' }).boundingBox();
    expect(commentsButtonBox).not.toBeNull();
    expect(commentsButtonBox!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
    expect(commentsButtonBox!.x + commentsButtonBox!.width).toBeLessThanOrEqual(1024);
  });

  test('automatically opens TikTok in fullscreen on mobile with a copy-link action', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reader');

    await expect(page.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More review actions' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Scroll view' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show comments' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open original' })).toHaveCount(0);
  });

  test('stays out of fullscreen after leaving TikTok fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/reader');

    const navbar = page.locator('.nav');
    const fullscreenButton = page.getByRole('button', { name: 'Exit Reader fullscreen' });
    await expect(navbar).toBeHidden();
    await expect(fullscreenButton).toBeVisible();
    await fullscreenButton.click();
    await expect(navbar).toBeVisible();
    await expect(page.locator('#main').getByRole('button', {
      name: 'Open Reader fullscreen',
    })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-reader-fullscreen', 'true');

    // A viewport change must not undo an explicit exit for the current TikTok.
    await page.setViewportSize({ width: 700, height: 844 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#main').getByRole('button', {
      name: 'Open Reader fullscreen',
    })).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-reader-fullscreen', 'true');
  });

  test('uses the available height in landscape', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const box = await player.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(440);
    expect(box!.height).toBeGreaterThan(780);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1366);
  });

  test('does not shrink when comments are shown', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    const collapsedBox = await player.boundingBox();

    await page.getByRole('button', { name: 'Show comments' }).click();
    await expect(page.getByRole('button', { name: 'Hide comments' })).toBeVisible();
    const expandedBox = await player.boundingBox();

    expect(collapsedBox).not.toBeNull();
    expect(expandedBox).not.toBeNull();
    expect(expandedBox!.width).toBeGreaterThanOrEqual(collapsedBox!.width - 1);
    expect(expandedBox!.height).toBeGreaterThanOrEqual(collapsedBox!.height - 1);
  });

  test('uses free horizontal space for comments in a tall desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1224, height: 1401 });
    await page.goto('/reader');

    await page.getByRole('button', { name: 'Show comments' }).click();
    const commentsBox = await page.locator('.tiktok-comments').boundingBox();

    expect(commentsBox).not.toBeNull();
    expect(commentsBox!.width).toBeGreaterThanOrEqual(420);
    expect(commentsBox!.width).toBeLessThanOrEqual(620);
  });

  test('makes the TikTok player larger in fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    await page.getByRole('button', { name: 'Show comments' }).click();
    const regularBox = await player.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('.reader__fullscreen-toolbar').getByRole('button', {
      name: 'Exit Reader fullscreen',
    })).toBeVisible();
    const fullscreenBox = await player.boundingBox();

    expect(regularBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox!.width).toBeGreaterThan(regularBox!.width);
    expect(fullscreenBox!.height).toBeGreaterThan(regularBox!.height);
    expect(Math.abs(fullscreenBox!.width * 16 / 9 - fullscreenBox!.height)).toBeLessThan(1);
  });

  test('keeps the TikTok comments rail wide in fullscreen', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await page.goto('/reader');

    await page.getByRole('button', { name: 'Show comments' }).click();
    const comments = page.locator('.tiktok-comments');
    const regularBox = await comments.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('.reader__fullscreen-toolbar').getByRole('button', {
      name: 'Exit Reader fullscreen',
    })).toBeVisible();
    const fullscreenBox = await comments.boundingBox();

    expect(regularBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox!.width).toBeGreaterThanOrEqual(420);
    expect(fullscreenBox!.width).toBeLessThanOrEqual(620);
  });

  test('does not add vertical bars around fullscreen feed images', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 22,
          feed_id: 4,
          link: 'https://www.reddit.com/r/opensource/comments/abc/event_dispatch/',
          title: 'Event Dispatch',
          text: '<img src="https://example.com/reddit-card.jpg">',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/reddit-card.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="#11111b"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    await expect(page.locator('.reader-card__preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    const bounds = await page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>('.reader-card__preview')?.getBoundingClientRect();
      const image = document.querySelector<HTMLImageElement>('.reader-card__preview img')?.getBoundingClientRect();
      return {
        previewHeight: preview?.height ?? 0,
        imageHeight: image?.height ?? 0,
        actionsBottom: document.querySelector<HTMLElement>('.reader__actions')?.getBoundingClientRect().bottom ?? 0,
        viewportHeight: window.innerHeight,
      };
    });

    expect(Math.abs(bounds.previewHeight - bounds.imageHeight)).toBeLessThan(3);
    expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.viewportHeight);
  });

  test('fits wide Instagram photos above fullscreen controls', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 24,
          feed_id: 4,
          link: 'https://www.instagram.com/p/wide-photo/',
          title: 'inst: photographer',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://www.instagram.com/p/wide-photo/',
        title: 'Wide photo',
        description: null,
        image: 'https://example.com/instagram-wide.jpg',
        video: null,
        siteName: 'Instagram',
        type: 'photo',
        providerData: null,
      },
    }));
    await page.route('https://example.com/instagram-wide.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#11111b"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const image = page.locator('.reader-card--instagram-photo img');
    await expect(image).toBeVisible();
    await expect(page.locator('.reader-card--instagram-photo .reader-card__preview'))
      .toHaveAttribute('data-media-orientation', 'landscape');
    const regularBox = await image.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect.poll(async () => {
      return page.evaluate(() => {
        const currentImageBox = document.querySelector('.reader-card--instagram-photo img')?.getBoundingClientRect();
        const currentActionsBox = document.querySelector('.reader__actions')?.getBoundingClientRect();
        if (!currentImageBox || !currentActionsBox) return false;
        return currentImageBox.bottom <= currentActionsBox.top;
      });
    }).toBe(true);
    const fullscreenLayout = await page.evaluate(() => {
      const currentImageBox = document.querySelector('.reader-card--instagram-photo img')?.getBoundingClientRect();
      const currentActionsBox = document.querySelector('.reader__actions')?.getBoundingClientRect();
      return currentImageBox && currentActionsBox ? {
        actionsBottom: currentActionsBox.bottom,
        actionsTop: currentActionsBox.top,
        imageBottom: currentImageBox.bottom,
        imageHeight: currentImageBox.height,
        imageWidth: currentImageBox.width,
      } : null;
    });

    expect(regularBox).not.toBeNull();
    expect(fullscreenLayout).not.toBeNull();
    expect(fullscreenLayout!.imageWidth).toBeGreaterThan(900);
    expect(Math.abs(fullscreenLayout!.imageWidth / fullscreenLayout!.imageHeight - 16 / 9)).toBeLessThan(0.01);
    expect(fullscreenLayout!.imageBottom).toBeLessThanOrEqual(fullscreenLayout!.actionsTop);
    expect(fullscreenLayout!.actionsBottom).toBeLessThanOrEqual(800);
  });

  test('keeps Instagram identity on a portrait photo', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 25,
          feed_id: 4,
          link: 'https://www.instagram.com/p/portrait-photo/',
          title: 'inst: portrait_creator',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://www.instagram.com/p/portrait-photo/',
        title: 'Portrait photo',
        description: null,
        image: 'https://example.com/instagram-portrait.jpg',
        video: null,
        siteName: 'Instagram',
        type: 'photo',
        providerData: null,
      },
    }));
    await page.route('https://example.com/instagram-portrait.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#f9e2af"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const preview = page.locator('.reader-card--instagram-photo .reader-card__preview');
    await expect(preview).toHaveAttribute('data-media-orientation', 'portrait');
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    await expect.poll(async () => {
      return page.evaluate(() => {
        const currentImageBox = document.querySelector('.reader-card--instagram-photo img')?.getBoundingClientRect();
        const currentIdentityBox = document.querySelector('.reader-card__short-video-identity')?.getBoundingClientRect();
        if (!currentImageBox || !currentIdentityBox) return false;
        return currentIdentityBox.top >= currentImageBox.top;
      });
    }).toBe(true);
    const overlayLayout = await page.evaluate(() => {
      const currentImageBox = document.querySelector('.reader-card--instagram-photo img')?.getBoundingClientRect();
      const currentIdentityBox = document.querySelector('.reader-card__short-video-identity')?.getBoundingClientRect();
      return currentImageBox && currentIdentityBox ? {
        identityLeft: currentIdentityBox.left,
        identityRight: currentIdentityBox.right,
        identityTop: currentIdentityBox.top,
        imageHeight: currentImageBox.height,
        imageLeft: currentImageBox.left,
        imageRight: currentImageBox.right,
        imageTop: currentImageBox.top,
      } : null;
    });
    expect(overlayLayout).not.toBeNull();
    expect(overlayLayout!.identityLeft).toBeGreaterThanOrEqual(overlayLayout!.imageLeft);
    expect(overlayLayout!.identityRight).toBeLessThanOrEqual(overlayLayout!.imageRight);
    expect(overlayLayout!.identityTop).toBeGreaterThanOrEqual(overlayLayout!.imageTop);
    expect(overlayLayout!.identityTop).toBeLessThan(overlayLayout!.imageTop + overlayLayout!.imageHeight / 3);
  });

  test('keeps the full VK image visible in regular and fullscreen cards', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 23,
          feed_id: 567,
          link: 'https://vk.com/wall-123_456',
          title: 'Рифмы и Панчи',
          text: '<img src="https://example.com/vk-card-cropped.jpg"><br>Post description',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/vk-card-cropped.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#11111b"/></svg>',
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://vk.com/wall-123_456',
        title: 'Рифмы и Панчи',
        description: null,
        image: 'https://example.com/vk-card-original.jpg',
        video: null,
        siteName: 'VK',
        type: 'article',
        providerData: null,
      },
    }));
    await page.route('https://example.com/vk-card-original.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#447bba"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const preview = page.locator('.reader-card--vk .reader-card__preview');
    const image = preview.locator('img');
    await expect(preview).toBeVisible();
    await expect(image).toHaveAttribute('src', 'https://example.com/vk-card-original.jpg');
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expect(page.locator('.reader-card--vk .reader-card__copy')).toContainText('Рифмы и Панчи');
    await expect(page.locator('.reader-card--vk .reader-card__description')).toHaveText('Post description');
    await expect(page.getByRole('link', { name: 'Open original' })).toHaveCount(0);
    const box = await preview.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(200);
    expect(Math.abs(box!.width / box!.height - 3 / 4)).toBeLessThan(0.01);

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(image).toHaveCSS('object-fit', 'contain');
    await expect(preview).toHaveAttribute('data-media-orientation', 'portrait');
    await expect(page.locator('.reader__item')).toHaveClass(/reader__item--fullscreen/);
    const fullscreenPreviewBox = await preview.boundingBox();
    const fullscreenImageBox = await image.boundingBox();
    const fullscreenCardBox = await page.locator('.reader-card--vk').boundingBox();
    const fullscreenCopyBox = await page.locator('.reader-card--vk .reader-card__copy').boundingBox();

    expect(fullscreenPreviewBox).not.toBeNull();
    expect(fullscreenImageBox).not.toBeNull();
    expect(fullscreenCardBox).not.toBeNull();
    expect(fullscreenCopyBox).not.toBeNull();
    expect(Math.abs(fullscreenPreviewBox!.width - fullscreenImageBox!.width)).toBeLessThan(2);
    expect(Math.abs(fullscreenPreviewBox!.height - fullscreenImageBox!.height)).toBeLessThan(2);
    expect(Math.abs(fullscreenImageBox!.width / fullscreenImageBox!.height - 3 / 4)).toBeLessThan(0.01);
    expect(fullscreenImageBox!.width).toBeGreaterThan(0.5 * 800);
    expect(fullscreenImageBox!.x - fullscreenCardBox!.x).toBeLessThan(0.26 * fullscreenCardBox!.width);
    expect(fullscreenCopyBox!.x).toBeGreaterThan(fullscreenImageBox!.x + fullscreenImageBox!.width);
    const imageCenter = fullscreenImageBox!.y + fullscreenImageBox!.height / 2;
    const copyCenter = fullscreenCopyBox!.y + fullscreenCopyBox!.height / 2;
    expect(Math.abs(imageCenter - copyCenter)).toBeLessThan(2);

    const reset = await page.locator('.reader__reset').boundingBox();
    const count = await page.locator('.reader__count').boundingBox();
    expect(reset).not.toBeNull();
    expect(count).not.toBeNull();
    expect(count!.x - (reset!.x + reset!.width)).toBeGreaterThanOrEqual(8);
    expect(count!.x - (reset!.x + reset!.width)).toBeLessThanOrEqual(16);
  });

  test('puts copy before the VK service banner in fullscreen', async ({ page }) => {
    const postText = 'Хочу искренне поблагодарить Николая Островского, владельца паблика. '
      + 'Если бы он не нашёл информацию о судебном решении, я бы об этом даже не узнал, '
      + 'и мне бы, по итогу, начислили огромный штраф.';
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 27,
          feed_id: 567,
          link: 'https://vk.com/wall-147782201_857022',
          title: 'МЫСЛИ СТАСА',
          text: postText,
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://vk.ru/wall-147782201_857022',
        title: 'Мысли Стаса. Пост со стены.',
        description: postText,
        image: 'https://example.com/vk-feed-placeholder.png',
        video: null,
        siteName: 'ВКонтакте',
        type: 'article',
        providerData: null,
      },
    }));
    await page.route('https://example.com/vk-feed-placeholder.png', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1010" viewBox="0 0 1920 1010"><rect width="1920" height="1010" fill="#07f"/></svg>',
    }));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/reader');

    const preview = page.locator('.reader-card--vk .reader-card__preview');
    await expect(preview).toHaveAttribute('data-vk-feed-placeholder', '');
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    const previewBox = await preview.boundingBox();
    const copyBox = await page.locator('.reader-card--vk .reader-card__copy').boundingBox();
    expect(previewBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(previewBox!.y);
    expect(copyBox!.width).toBeLessThanOrEqual(762);
    expect(copyBox!.height).toBeLessThan(500);
    expect(previewBox!.width).toBeLessThanOrEqual(442);
  });

  test('clips square VK post images to rounded corners', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 26,
          feed_id: 567,
          link: 'https://vk.com/wall-182864292_1335509',
          title: 'STREAM INSIDE',
          text: 'Post description',
        }],
        next_cursor: null,
      },
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://vk.ru/wall-182864292_1335509',
        title: 'STREAM INSIDE. Пост со стены.',
        description: 'Post description',
        image: 'https://example.com/vk-square.jpg',
        video: null,
        siteName: 'ВКонтакте',
        type: 'article',
        providerData: null,
      },
    }));
    await page.route('https://example.com/vk-square.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="#f9e2af"/></svg>',
    }));
    await page.setViewportSize({ width: 2048, height: 1152 });
    await page.goto('/reader');
    await expect(page.locator('.reader-card__preview--image img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();

    await expect(page.locator('.reader__item')).toHaveClass(/reader__item--fullscreen/);
    await expect(page.locator('main')).toHaveAttribute('data-reader-fullscreen', 'true');
    const preview = page.locator('.reader-card--vk .reader-card__preview');
    const imageSurface = preview.locator('.reader-card__image-surface');
    const image = imageSurface.locator('img');
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS('overflow', 'hidden');
    await expect(preview).toHaveCSS('border-radius', '22px');
    await expect(preview).toHaveCSS('clip-path', 'inset(0px round 22px)');
    await expect(imageSurface).toBeVisible();
    await expect(imageSurface).toHaveCSS('overflow', 'hidden');
    await expect(imageSurface).toHaveCSS('border-radius', '22px');
    const surfaceBox = await imageSurface.boundingBox();
    const imageBox = await image.boundingBox();
    expect(surfaceBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(Math.abs(surfaceBox!.width - imageBox!.width)).toBeLessThan(2);
    expect(Math.abs(surfaceBox!.height - imageBox!.height)).toBeLessThan(2);
    const clipsTopCorners = await imageSurface.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [bounds.left + 1, bounds.right - 1].every((x) => {
        const target = document.elementFromPoint(x, bounds.top + 1);
        return !target || !element.contains(target);
      });
    });
    expect(clipsTopCorners).toBe(true);
  });

  test('expands a landscape VK image to the fullscreen card width', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 24,
          feed_id: 567,
          link: 'https://vk.com/wall-123_789',
          title: '36 студия',
          text: '<img src="https://example.com/vk-landscape.jpg"><br>Post description',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/vk-landscape.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#551044"/></svg>',
    }));
    await page.route('**/bff/open-graph?**', (route) => route.fulfill({
      json: {
        url: 'https://vk.com/wall-123_789',
        title: '36 студия',
        description: null,
        image: 'https://example.com/vk-landscape.jpg',
        video: null,
        siteName: 'VK',
        type: 'article',
        providerData: null,
      },
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const preview = page.locator('.reader-card--vk .reader-card__preview');
    const image = preview.locator('img');
    await expect(image).toBeVisible();
    const regularBox = await image.boundingBox();

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('#main').getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();
    const fullscreenBox = await image.boundingBox();

    expect(regularBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect(fullscreenBox!.width).toBeGreaterThan(regularBox!.width);
    expect(fullscreenBox!.width).toBeGreaterThan(900);
    expect(fullscreenBox!.height).toBeGreaterThan(400);
    await expect(preview).toHaveCSS('border-radius', '22px');
    await expect(image).toHaveCSS('object-fit', 'contain');
    const fullscreenPreviewBox = await preview.boundingBox();
    const fullscreenCopyBox = await page.locator('.reader-card--vk .reader-card__copy').boundingBox();
    expect(fullscreenPreviewBox).not.toBeNull();
    expect(fullscreenCopyBox).not.toBeNull();
    expect(fullscreenPreviewBox!.height).toBeGreaterThanOrEqual(fullscreenBox!.height);
    await expect(image).toHaveCSS('border-radius', '22px');
    await expect(image).toHaveCSS('clip-path', 'inset(0px round 22px)');
    expect(fullscreenCopyBox!.y).toBeGreaterThanOrEqual(
      fullscreenPreviewBox!.y + fullscreenPreviewBox!.height,
    );
  });

  test('uses the reader width for VK video embeds', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 25,
          feed_id: 567,
          link: 'https://vk.com/video-123_456',
          title: 'VK video',
          text: 'Video description',
        }],
        next_cursor: null,
      },
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    const card = page.locator('.reader-card--vk');
    const player = card.locator('.reader-card__preview--video');
    await expect(player).toBeVisible();
    const cardBox = await card.boundingBox();
    const actionsBox = await page.locator('.reader__actions').boundingBox();

    expect(cardBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(cardBox!.width).toBeGreaterThan(600);
    expect(Math.abs(cardBox!.width - actionsBox!.width)).toBeLessThan(2);

    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    const clipsTopCorner = await page.evaluate(() => {
      const preview = document.querySelector<HTMLElement>('.reader-card--vk .reader-card__preview--video');
      if (!preview) return false;
      const bounds = preview.getBoundingClientRect();
      const cornerTarget = document.elementFromPoint(bounds.left + 1, bounds.top + 1);
      return !cornerTarget || !preview.contains(cornerTarget);
    });
    const fullscreenGap = await page.evaluate(() => {
      const media = document.querySelector('.reader-card--vk .reader-card__preview--video :is(video, iframe)')
        ?.getBoundingClientRect();
      const copy = document.querySelector('.reader-card--vk .reader-card__copy')
        ?.getBoundingClientRect();
      return media && copy ? copy.top - media.bottom : null;
    });
    expect(clipsTopCorner).toBe(true);
    expect(fullscreenGap).not.toBeNull();
    expect(fullscreenGap!).toBeGreaterThanOrEqual(0);
    expect(fullscreenGap!).toBeLessThanOrEqual(24);
  });

  test('keeps regular image cards and review actions inside fullscreen', async ({ page }) => {
    await page.route('**/api/v1/get_items?**', (route) => route.fulfill({
      json: {
        items: [{
          id: 21,
          feed_id: 4,
          link: 'https://example.com/poster.jpg',
          title: 'A long image title that should wrap inside the fullscreen reader',
          text: '',
        }],
        next_cursor: null,
      },
    }));
    await page.route('https://example.com/poster.jpg', (route) => route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1000" viewBox="0 0 900 1000"><rect width="900" height="1000" fill="#a6e3a1"/></svg>',
    }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/reader');

    await expect(page.locator('.reader-card__preview img')).toBeVisible();
    await page.getByRole('button', { name: 'Open Reader fullscreen' }).click();
    await expect(page.locator('#main').getByRole('button', { name: 'Exit Reader fullscreen' })).toBeVisible();
    await expect(page.locator('.reader-card__preview')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.reader-card__preview')).toHaveCSS('border-top-width', '0px');
    await expect(page.locator('.reader-card__preview img')).toHaveCSS('border-radius', '22px');

    const bounds = await page.evaluate(() => {
      const item = document.querySelector<HTMLElement>('.reader__item');
      const actions = document.querySelector<HTMLElement>('.reader__actions');
      const preview = document.querySelector<HTMLElement>('.reader-card__preview');
      const copy = document.querySelector<HTMLElement>('.reader-card__copy');
      const previewBox = preview?.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        itemRight: item?.getBoundingClientRect().right ?? 0,
        actionsRight: actions?.getBoundingClientRect().right ?? 0,
        itemLeft: item?.getBoundingClientRect().left ?? 0,
        actionsLeft: actions?.getBoundingClientRect().left ?? 0,
        itemWidth: item?.getBoundingClientRect().width ?? 0,
        actionsWidth: actions?.getBoundingClientRect().width ?? 0,
        cardWidth: document.querySelector<HTMLElement>('.reader-card')?.getBoundingClientRect().width ?? 0,
        previewWidth: previewBox?.width ?? 0,
        previewHeight: previewBox?.height ?? 0,
        imageWidth: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().width ?? 0,
        imageHeight: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().height ?? 0,
        imageLeft: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().left ?? 0,
        imageRight: document.querySelector<HTMLElement>('.reader-card__preview img')?.getBoundingClientRect().right ?? 0,
        previewRight: previewBox?.right ?? 0,
        previewBottom: previewBox?.bottom ?? 0,
        copyTop: copy?.getBoundingClientRect().top ?? 0,
        actionsBottom: actions?.getBoundingClientRect().bottom ?? 0,
        viewportHeight: window.innerHeight,
        previewCenter: previewBox ? previewBox.left + previewBox.width / 2 : 0,
      };
    });

    expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.itemRight).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(bounds.actionsRight).toBeLessThanOrEqual(bounds.viewportWidth);
    expect(Math.abs(bounds.itemWidth - bounds.actionsWidth)).toBeLessThan(1);
    expect(Math.abs(bounds.itemLeft - bounds.actionsLeft)).toBeLessThan(1);
    expect(Math.abs(bounds.itemWidth - bounds.cardWidth)).toBeLessThan(1);
    expect(bounds.imageWidth).toBeLessThanOrEqual(bounds.previewWidth);
    expect(bounds.imageHeight).toBeLessThanOrEqual(bounds.previewHeight);
    expect(bounds.imageLeft).toBeGreaterThanOrEqual(bounds.previewRight - bounds.previewWidth);
    expect(bounds.imageRight).toBeLessThanOrEqual(bounds.previewRight);
    expect(Math.abs(bounds.imageWidth / bounds.imageHeight - 9 / 10)).toBeLessThan(0.01);
    expect(bounds.actionsBottom).toBeLessThanOrEqual(bounds.viewportHeight);
    expect(Math.abs(bounds.previewCenter - bounds.viewportWidth / 2)).toBeLessThan(1);
    expect(bounds.copyTop - bounds.previewBottom).toBeGreaterThanOrEqual(0);
    expect(bounds.copyTop - bounds.previewBottom).toBeLessThanOrEqual(24);
  });

  test('reflows controls after rotating from landscape to portrait', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 1024 });
    await page.goto('/reader');

    const player = page.locator('.reader-card__preview--tiktok');
    await expect(player).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 1366 });

    await expect.poll(async () => (await player.boundingBox())?.width).toBeLessThan(600);
    const playerBox = await player.boundingBox();
    const commentsButtonBox = await page.getByRole('button', { name: 'Show comments' }).boundingBox();

    expect(playerBox).not.toBeNull();
    expect(commentsButtonBox).not.toBeNull();
    expect(commentsButtonBox!.y).toBeGreaterThanOrEqual(playerBox!.y + playerBox!.height);
    expect(commentsButtonBox!.x + commentsButtonBox!.width).toBeLessThanOrEqual(1024);
  });
});

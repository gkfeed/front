import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp,
}));

import { fetchOpenGraph } from './openGraph.js';
import { htmlResponse } from './openGraphTestFixtures.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
});

describe('Matreshka OpenGraph provider', () => {
  it('extracts metadata before its oversized inline application shell', async () => {
    const html = [
      '<head>',
      '<meta property="og:title" content="Matreshka video">',
      '<meta property="og:image" content="https://c4-images.cmtv.ru/video/channel/video/1280x720_preview.png">',
      `<style>${'x'.repeat(300_000)}</style>`,
      '</head>',
    ].join('');
    requestPublicHttp.mockImplementation(async (url: URL) => htmlResponse(html, url));

    await expect(fetchOpenGraph('https://matreshka.tv/video/video'))
      .resolves.toMatchObject({
        title: 'Matreshka video',
        image: 'https://c4-images.cmtv.ru/video/channel/video/1280x720_preview.png',
      });
  });
});

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
  it('extracts metadata and the highest-quality stream from the video page', async () => {
    const html = [
      '<head>',
      '<meta property="og:title" content="Matreshka video">',
      '<meta property="og:image" content="https://c4-images.cmtv.ru/video/channel/video/1280x720_preview.png">',
      '</head>',
      `<style>${'x'.repeat(300_000)}</style>`,
      String.raw`<script>{"1080":"https:\u002F\u002Fc4-video.cmtv.ru\u002Fhm\u002Fchannel\u002FdG9rZW4=\u002Fmaster.m3u8?expires=10\u0026md5=full-hd"}</script>`,
    ].join('');
    requestPublicHttp.mockImplementation(async (url: URL) => htmlResponse(html, url));

    await expect(fetchOpenGraph('https://matreshka.tv/video/video'))
      .resolves.toMatchObject({
        title: 'Matreshka video',
        image: 'https://c4-images.cmtv.ru/video/channel/video/1280x720_preview.png',
        video: 'https://c4-video.cmtv.ru/hm/channel/dG9rZW4=/master.m3u8?expires=10&md5=full-hd',
      });
    expect(requestPublicHttp).toHaveBeenCalledWith(
      new URL('https://matreshka.tv/video/video'),
      expect.anything(),
    );
  });
});

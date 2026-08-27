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

describe('Instagram OpenGraph provider', () => {
  it.each([
    ['GraphVideo', true, 'video'],
    ['GraphImage', false, 'photo'],
  ] as const)('detects %s media from the official embed data', async (typename, isVideo, type) => {
    const requestedUrl = new URL('https://www.instagram.com/p/DcZUpIItbZu/');
    requestPublicHttp.mockImplementation(async (url: URL) => htmlResponse(`
      <meta property="og:image" content="https://example.com/poster.jpg">
      <script>window.__data = "{\\"shortcode_media\\":{\\"__typename\\":\\"${typename}\\",\\"is_video\\":${isVideo}${isVideo ? ',\\"video_url\\":\\"https://scontent.cdninstagram.com/video.mp4?token=example\\"' : ''}}}";</script>
    `, url));

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      url: requestedUrl.href,
      image: 'https://example.com/poster.jpg',
      type,
      video: isVideo ? 'https://scontent.cdninstagram.com/video.mp4?token=example' : null,
    });
    expect(requestPublicHttp.mock.calls[0]?.[0].href)
      .toBe('https://www.instagram.com/p/DcZUpIItbZu/embed/');
  });
});

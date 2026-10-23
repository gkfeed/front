import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp,
}));

import { fetchOpenGraph, parseOpenGraph } from './openGraph.js';
import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { htmlResponse } from './openGraphTestFixtures.js';

beforeEach(() => requestPublicHttp.mockReset());

describe('Shikimori OpenGraph provider', () => {
  it.each(['shikimori.one', 'shikimori.io'])('fetches %s anime previews from the current host', async (host) => {
    const path = '/animes/59135-class-no-daikirai-na-joshi-to-kekkon-suru-koto-ni-natta';
    const currentUrl = new URL(`https://shikimori.io${path}`);
    const context = createDetachedRequestExecutionContext();
    requestPublicHttp.mockResolvedValue(htmlResponse(`
      <html><head>
        <meta property="og:title" content="Class no Daikirai">
        <meta property="og:image" content="/uploads/poster/animes/59135/main.webp">
      </head><body>
        <meta itemprop="alternativeHeadline" content="Я женился на однокласснице, которую ненавидел">
      </body></html>
    `, currentUrl));

    await expect(fetchOpenGraph(`https://${host}${path}`, context)).resolves.toMatchObject({
      url: currentUrl.href,
      title: 'Я женился на однокласснице, которую ненавидел',
      image: 'https://shikimori.io/uploads/poster/animes/59135/main.webp',
    });
    expect(requestPublicHttp).toHaveBeenCalledExactlyOnceWith(currentUrl, {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)',
    }, context);
  });

  it('prefers the Russian anime title', () => {
    const html = `
      <meta property="og:title" content="World Is Dancing">
      <meta itemprop="alternativeHeadline" content="Мир танцует">
      <meta property="og:image" content="/uploads/poster/animes/63347/main.webp">
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://shikimori.one/animes/63347-world-is-dancing'),
    )).toMatchObject({
      title: 'Мир танцует',
      image: 'https://shikimori.one/uploads/poster/animes/63347/main.webp',
    });
  });

  it('keeps the Open Graph title when no Russian title is available', () => {
    expect(parseOpenGraph(
      '<meta property="og:title" content="World Is Dancing">',
      new URL('https://shikimori.io/animes/63347-world-is-dancing'),
    ).title).toBe('World Is Dancing');
  });
});

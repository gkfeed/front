import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp,
}));

import { fetchOpenGraph } from './openGraph.js';
import { parseOpenGraph } from './openGraphParser.js';
import { gzipHtmlResponse } from './openGraphTestFixtures.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
});

describe('Rezka OpenGraph provider', () => {
  it('prefers the original Rezka cover over its small social preview', () => {
    const html = `
      <meta property="og:image" content="/covers/social.jpg">
      <div class="b-sidecover">
        <a data-imagelightbox="cover" href="/covers/original.jpg">
          <img src="/covers/thumbnail.jpg" alt="Story">
        </a>
      </div>
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://rezka.ag/films/drama/123-story.html'),
    ).image).toBe('https://rezka.ag/covers/original.jpg');
  });

  it('uses the Rezka preview host and crawler profile used by gkbot', async () => {
    requestPublicHttp.mockResolvedValue(gzipHtmlResponse(
      '<meta property="og:image" content="/covers/story.jpg">',
      new URL('https://rezka.ag/films/drama/123-story.html'),
    ));

    await expect(fetchOpenGraph('https://hdrezka.me/films/drama/123-story.html'))
      .resolves.toMatchObject({
        image: 'https://rezka.ag/covers/story.jpg',
        url: 'https://rezka.ag/films/drama/123-story.html',
      });
    expect(requestPublicHttp).toHaveBeenCalledWith(
      new URL('https://rezka.ag/films/drama/123-story.html'),
      {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'TelegramBot (like TwitterBot)',
      },
    );
  });

  it('falls back to the requested host when the mirror does not have the item', async () => {
    const requestedUrl = new URL('https://hdrezka.me/series/comedy/91415-kop-zvezda-2026.html');
    requestPublicHttp.mockImplementation((url: URL) => {
      if (url.hostname === 'rezka.ag') {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 404,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<meta property="og:image" content="/covers/kop-zvezda.jpg">',
        requestedUrl,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      image: 'https://hdrezka.me/covers/kop-zvezda.jpg',
      url: requestedUrl.href,
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/series/comedy/91415-kop-zvezda-2026.html',
      requestedUrl.href,
    ]);
  });

  it('also falls back when the mirror returns a page without preview metadata', async () => {
    const requestedUrl = new URL('https://hdrezka.me/series/comedy/91415-kop-zvezda-2026.html');
    requestPublicHttp.mockImplementation((url: URL) => Promise.resolve(gzipHtmlResponse(
      url.hostname === 'rezka.ag'
        ? '<title>Коп-звезда</title>'
        : '<meta property="og:image" content="/covers/kop-zvezda.jpg">',
      url,
    )));

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      image: 'https://hdrezka.me/covers/kop-zvezda.jpg',
      url: requestedUrl.href,
    });
    expect(requestPublicHttp).toHaveBeenCalledTimes(2);
  });
});

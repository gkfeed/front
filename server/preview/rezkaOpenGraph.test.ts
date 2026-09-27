import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp,
}));

import { fetchOpenGraph } from './openGraph.js';
import { parseOpenGraph } from './openGraph.js';
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

  it('recovers a stale series URL through its latest-series page', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/series/documentary/30365-formula-1-gonyat-chtoby-vyzhivat-2019.html',
    );
    requestPublicHttp.mockImplementation((url: URL) => {
      if (!url.pathname.endsWith('-latest.html')) {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 500,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<meta property="og:image" content="https://static.hdrezka.ac/covers/formula-1.jpg">',
        url,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      image: 'https://static.hdrezka.ac/covers/formula-1.jpg',
      url: 'https://rezka.ag/series/documentary/30365-formula-1-gonyat-chtoby-vyzhivat-2019-latest.html',
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/series/documentary/30365-formula-1-gonyat-chtoby-vyzhivat-2019.html',
      requestedUrl.href,
      'https://rezka.ag/series/documentary/30365-formula-1-gonyat-chtoby-vyzhivat-2019-latest.html',
    ]);
  });

  it('uses the normal animation page when an episode link has a broken latest suffix', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/animation/fantasy/90799-hell-mode-tv-2-2026-latest.html',
    );
    requestPublicHttp.mockImplementation((url: URL) => {
      if (url.pathname.endsWith('-latest.html')) {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 500,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<div class="b-sidecover"><a href="https://static.hdrezka.ac/covers/hell-mode.jpg"><img src="/small.jpg"></a></div>',
        url,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      image: 'https://static.hdrezka.ac/covers/hell-mode.jpg',
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/animation/fantasy/90799-hell-mode-tv-2-2026.html',
    ]);
  });

  it('recovers a film preview when only its latest page exists', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/films/melodrama/89218-vsego-odna-noch-2026-latest.html',
    );
    requestPublicHttp.mockImplementation((url: URL) => {
      if (!url.pathname.endsWith('-latest.html')) {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 500,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<meta property="og:title" content="Всего одна ночь / Только на одну ночь (2026)">'
          + '<meta property="og:image" content="https://static.hdrezka.ac/i/2026/8/24/h91539914457dkp13a82o.jpg">',
        url,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      title: 'Всего одна ночь / Только на одну ночь (2026)',
      image: 'https://static.hdrezka.ac/i/2026/8/24/h91539914457dkp13a82o.jpg',
      url: 'https://rezka.ag/films/melodrama/89218-vsego-odna-noch-2026-latest.html',
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/films/melodrama/89218-vsego-odna-noch-2026.html',
      'https://hdrezka.me/films/melodrama/89218-vsego-odna-noch-2026.html',
      'https://rezka.ag/films/melodrama/89218-vsego-odna-noch-2026-latest.html',
    ]);
  });

  it('recovers a renamed series preview through its alternate page', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/series/comedy/92080-opg-2026-latest.html',
    );
    const alternateUrl = new URL('https://rezka.ag/series/comedy/92080-opg-2026-u.html');
    requestPublicHttp.mockImplementation((url: URL) => {
      if (url.href === requestedUrl.href) {
        return Promise.resolve(gzipHtmlResponse('<title>Проверяем, что вы не бот!</title>', url));
      }
      if (url.href !== alternateUrl.href) {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 500,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<meta property="og:title" content="ОПГ (2026)">'
          + '<meta property="og:image" content="https://static.hdrezka.ac/i/2026/8/25/o25e2d414297amb13d70s.jpg">',
        url,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      title: 'ОПГ (2026)',
      image: 'https://static.hdrezka.ac/i/2026/8/25/o25e2d414297amb13d70s.jpg',
      url: alternateUrl.href,
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/series/comedy/92080-opg-2026.html',
      'https://hdrezka.me/series/comedy/92080-opg-2026.html',
      'https://rezka.ag/series/comedy/92080-opg-2026-latest.html',
      requestedUrl.href,
      alternateUrl.href,
    ]);
  });

  it('recovers a cartoon preview when only its latest page exists', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/cartoons/comedy/90746-prezident-kertis-2026-latest.html',
    );
    requestPublicHttp.mockImplementation((url: URL) => {
      if (!url.pathname.endsWith('-latest.html')) {
        return Promise.resolve({
          body: { destroy: vi.fn() },
          headers: { 'content-type': 'text/html; charset=utf-8' },
          status: 500,
          url,
        });
      }
      return Promise.resolve(gzipHtmlResponse(
        '<meta property="og:title" content="Президент Кертис (2026)">'
          + '<meta property="og:image" content="https://static.hdrezka.ac/i/2026/7/15/d6cf1e8fae28fae55c97r.jpg">',
        url,
      ));
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      title: 'Президент Кертис (2026)',
      image: 'https://static.hdrezka.ac/i/2026/7/15/d6cf1e8fae28fae55c97r.jpg',
      url: 'https://rezka.ag/cartoons/comedy/90746-prezident-kertis-2026-latest.html',
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/cartoons/comedy/90746-prezident-kertis-2026.html',
      'https://hdrezka.me/cartoons/comedy/90746-prezident-kertis-2026.html',
      'https://rezka.ag/cartoons/comedy/90746-prezident-kertis-2026-latest.html',
    ]);
  });

  it('finds a renamed film by its Rezka ID in search results', async () => {
    const requestedUrl = new URL(
      'https://hdrezka.me/films/drama/89473-soperniki-amzii-king-2025.html',
    );
    const renamedUrl = new URL(
      'https://rezka.ag/films/drama/89473-soperniki-amzia-kinga-2025-latest.html',
    );
    requestPublicHttp.mockImplementation((url: URL) => {
      if (url.pathname === '/search/') {
        return Promise.resolve(gzipHtmlResponse(
          '<div class="b-content__inline_item" data-id="89473"'
            + ` data-url="${renamedUrl.href}"></div>`,
          url,
        ));
      }
      if (url.href === renamedUrl.href) {
        return Promise.resolve(gzipHtmlResponse(
          '<meta property="og:title" content="Соперники Амзиа Кинга (2025)">'
            + '<meta property="og:image" content="https://static.hdrezka.ac/i/2026/9/17/kb2d00ea21dcbzm89g59b.jpg">',
          url,
        ));
      }
      return Promise.resolve({
        body: { destroy: vi.fn() },
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 500,
        url,
      });
    });

    await expect(fetchOpenGraph(requestedUrl.href)).resolves.toMatchObject({
      title: 'Соперники Амзиа Кинга (2025)',
      image: 'https://static.hdrezka.ac/i/2026/9/17/kb2d00ea21dcbzm89g59b.jpg',
      url: renamedUrl.href,
    });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.href)).toEqual([
      'https://rezka.ag/films/drama/89473-soperniki-amzii-king-2025.html',
      requestedUrl.href,
      'https://rezka.ag/films/drama/89473-soperniki-amzii-king-2025-latest.html',
      'https://hdrezka.me/films/drama/89473-soperniki-amzii-king-2025-latest.html',
      'https://rezka.ag/films/drama/89473-soperniki-amzii-king-2025-u.html',
      'https://hdrezka.me/films/drama/89473-soperniki-amzii-king-2025-u.html',
      'https://rezka.ag/search/?do=search&subaction=search&q=soperniki-amzii-king-2025',
      renamedUrl.href,
    ]);
  });

  it.each([
    '<div data-id="89474" data-url="https://rezka.ag/films/drama/89474-other.html"></div>',
    '<div data-id="89473" data-url="https://example.com/films/drama/89473-other.html"></div>',
  ])('rejects unrelated search results: %s', async (searchResult) => {
    requestPublicHttp.mockImplementation((url: URL) => {
      if (url.pathname === '/search/') {
        return Promise.resolve(gzipHtmlResponse(searchResult, url));
      }
      return Promise.resolve({
        body: { destroy: vi.fn() },
        headers: { 'content-type': 'text/html; charset=utf-8' },
        status: 500,
        url,
      });
    });

    await expect(fetchOpenGraph(
      'https://hdrezka.me/films/drama/89473-soperniki-amzii-king-2025.html',
    )).rejects.toMatchObject({ kind: 'upstream_error' });
    expect(requestPublicHttp.mock.calls.map(([url]) => url.hostname))
      .not.toContain('example.com');
  });
});

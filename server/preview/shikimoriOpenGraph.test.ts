import { describe, expect, it } from 'vitest';

import { parseOpenGraph } from './openGraph.js';

describe('Shikimori OpenGraph provider', () => {
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

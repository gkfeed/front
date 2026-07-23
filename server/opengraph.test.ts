import { describe, expect, it } from 'vitest';

import { fetchRedditPreviewImage, parseOpenGraph } from './opengraph.js';

describe('parseOpenGraph', () => {
  it('extracts Open Graph metadata regardless of attribute order', () => {
    const html = `
      <html><head>
        <meta content="Example &amp; Sons" property="og:title">
        <meta property='og:description' content='A useful preview'>
        <meta content="/cover.jpg" property="og:image">
        <meta property="og:site_name" content="Example">
        <meta property="og:type" content="article">
      </head></html>`;

    expect(parseOpenGraph(html, new URL('https://example.com/posts/1'))).toEqual({
      url: 'https://example.com/posts/1',
      title: 'Example & Sons',
      description: 'A useful preview',
      image: 'https://example.com/cover.jpg',
      video: null,
      siteName: 'Example',
      type: 'article',
    });
  });

  it('falls back to standard title and description metadata', () => {
    const html = '<title>Fallback title</title><meta name="description" content="Fallback description">';

    expect(parseOpenGraph(html, new URL('https://example.com')).title).toBe('Fallback title');
    expect(parseOpenGraph(html, new URL('https://example.com')).description).toBe('Fallback description');
  });

  it('rejects non-http image URLs', () => {
    const html = '<meta property="og:image" content="javascript:alert(1)">';
    expect(parseOpenGraph(html, new URL('https://example.com')).image).toBeNull();
  });

  it('uses the Twitter metadata fallbacks supported by gkbot', () => {
    const html = `
      <meta name="twitter:title" content="Social title">
      <meta name="twitter:description" content="Social description">
      <meta name="twitter:image" value="/social.jpg">
      <meta name="twitter:player:stream" content="/clip.mp4">
    `;

    expect(parseOpenGraph(html, new URL('https://example.com/post'))).toMatchObject({
      title: 'Social title',
      description: 'Social description',
      image: 'https://example.com/social.jpg',
      video: 'https://example.com/clip.mp4',
    });
  });
});

describe('fetchRedditPreviewImage', () => {
  it('only accepts generated Reddit preview image URLs', async () => {
    await expect(fetchRedditPreviewImage('https://example.com/preview/post/abc123'))
      .rejects.toMatchObject({ status: 400, code: 'invalid_reddit_preview' });
  });
});

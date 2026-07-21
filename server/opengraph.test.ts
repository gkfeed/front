import { describe, expect, it } from 'vitest';

import { parseOpenGraph } from './opengraph.js';

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
});

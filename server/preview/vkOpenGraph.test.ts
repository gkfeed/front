import { describe, expect, it, vi } from 'vitest';

import { jsonLdScript } from './openGraphTestFixtures.js';
import { fetchOpenGraph, parseOpenGraph } from './openGraph.js';
import { fetchVkHtml } from './vkFetcher.js';

vi.mock('./vkFetcher.js', () => ({ fetchVkHtml: vi.fn() }));

describe('parseOpenGraph: VK provider', () => {
  it('marks a missing VK wall post as deleted', () => {
    const preview = parseOpenGraph(
      '<div data-testid="page_not_found_placeholder"></div>',
      new URL('https://vk.ru/wall-45277565_394259'),
    );

    expect(preview.providerData).toEqual({ provider: 'vk', status: 'deleted' });
    expect(preview.image).toBeNull();
    expect(preview.video).toBeNull();
  });

  it('preserves the video embed from the reported STREAM INSIDE post', async () => {
    vi.mocked(fetchVkHtml).mockResolvedValue({
      url: new URL('https://vk.ru/wall-182864292_1336279'),
      html: `<meta property="og:video" content="https://vk.ru/video_ext.php?oid=-182864292&amp;id=456257584&amp;hash=2ad8edc0b31dd0da"/>
        <meta property="og:video:type" content="text/html"/>
        <meta property="og:type" content="video.other"/>`,
    });

    await expect(fetchOpenGraph('https://vk.com/wall-182864292_1336279')).resolves.toMatchObject({
      video: 'https://vk.ru/video_ext.php?oid=-182864292&id=456257584&hash=2ad8edc0b31dd0da',
      type: 'video.other',
    });
  });

  it('upgrades VK image CDN URLs to HTTPS', () => {
    const html = `
      <meta property="og:image"
        content="http://sun9-67.vkuserphoto.ru/impg/photo.jpg?size=1170x1560">
    `;

    expect(parseOpenGraph(
      html,
      new URL('https://vk.ru/wall-118222154_8712'),
    ).image).toBe('https://sun9-67.vkuserphoto.ru/impg/photo.jpg?size=1170x1560');
  });

  it('extracts a VK video embed and thumbnail from structured data', () => {
    const html = jsonLdScript({
      '@context': 'https://schema.org',
      '@type': 'SocialMediaPosting',
      video: [{
        '@type': 'VideoObject',
        thumbnailUrl: 'https://iv.okcdn.ru/getVideoPreview?id=123',
        embedUrl: 'https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret',
      }],
    });

    expect(parseOpenGraph(
      html,
      new URL('https://vk.ru/wall-28905875_36129480'),
    )).toMatchObject({
      image: 'https://iv.okcdn.ru/getVideoPreview?id=123',
      video: 'https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret',
    });
  });
});

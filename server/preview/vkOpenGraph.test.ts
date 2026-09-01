import { describe, expect, it } from 'vitest';

import { jsonLdScript } from './openGraphTestFixtures.js';
import { parseOpenGraph } from './openGraph.js';

describe('parseOpenGraph: VK provider', () => {
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

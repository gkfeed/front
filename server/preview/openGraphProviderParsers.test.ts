import { describe, expect, it } from 'vitest';

import {
  parseRezkaOriginalCover,
  parseVkStructuredVideo,
} from './openGraphProviderParsers.js';

describe('parseVkStructuredVideo', () => {
  it('extracts a nested VideoObject through a shared runtime guard', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@graph': [{
        '@type': 'Article',
        video: {
          '@type': 'VideoObject',
          embedUrl: 'https://vkvideo.ru/video_ext.php?oid=-1&id=2',
          thumbnailUrl: 'https://cdn.example/video.jpg',
        },
      }],
    })}</script>`;

    expect(parseVkStructuredVideo(html, new URL('https://vk.ru/wall-1_2'))).toEqual({
      embedUrl: 'https://vkvideo.ru/video_ext.php?oid=-1&id=2',
      image: 'https://cdn.example/video.jpg',
    });
  });

  it('rejects malformed JSON-LD values without throwing', () => {
    const payloads: unknown[] = [
      null,
      [],
      'VideoObject',
      { '@type': 'VideoObject', embedUrl: {} },
      { video: [{ '@type': 'VideoObject', embedUrl: 'javascript:alert(1)' }] },
      { '@graph': [{ video: { '@type': 'VideoObject', embedUrl: 'https://vk.ru/video_ext.php?id=2' } }] },
    ];

    for (const payload of payloads) {
      const html = `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
      expect(() => parseVkStructuredVideo(html, new URL('https://vk.ru/wall-1_2')))
        .not.toThrow();
      expect(parseVkStructuredVideo(html, new URL('https://vk.ru/wall-1_2'))).toBeNull();
    }
  });

  it('ignores structured data from non-VK pages', () => {
    const html = '<script type="application/ld+json">{"@type":"VideoObject"}</script>';
    expect(parseVkStructuredVideo(html, new URL('https://example.com/'))).toBeNull();
  });
});

describe('parseRezkaOriginalCover', () => {
  it('ignores malformed or non-http cover links', () => {
    expect(parseRezkaOriginalCover(
      '<div class="b-sidecover"><a href="javascript:alert(1)"></a></div>',
      new URL('https://rezka.ag/films/story'),
    )).toBeNull();
  });
});

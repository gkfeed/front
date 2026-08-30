import { describe, expect, it } from 'vitest';

import { parseInstagramEmbedMedia } from './providers/instagram.js';
import { parseMatreshkaVideoUrl } from './providers/matreshka.js';
import { parseRezkaOriginalCover } from './providers/rezka.js';
import { parseSasflixVideoUrl } from './providers/sasflix.js';
import { parseVkStructuredVideo } from './providers/vk.js';

describe('parseInstagramEmbedMedia', () => {
  it('extracts a playable video URL from escaped embed data', () => {
    const payload = JSON.stringify({
      shortcode_media: {
        __typename: 'GraphVideo',
        is_video: true,
        video_url: 'https:\\/\\/scontent.cdninstagram.com\\/video.mp4?token=example&amp;expires=123',
      },
    });
    const html = `<script>window.__data = ${JSON.stringify(payload)};</script>`;

    expect(parseInstagramEmbedMedia(html)).toEqual({
      type: 'video',
      videoUrl: 'https://scontent.cdninstagram.com/video.mp4?token=example&expires=123',
      imageUrl: null,
    });
  });

  it('does not invent a video URL for a photo', () => {
    const html = '<script>"shortcode_media":{"is_video":false}</script>';
    expect(parseInstagramEmbedMedia(html)).toEqual({
      type: 'photo',
      videoUrl: null,
      imageUrl: null,
    });
  });

  it('extracts a playable video URL from modern media info', () => {
    const payload = JSON.stringify({
      xdt_api__v1__media__shortcode__web_info: {
        items: [{
          media_type: 2,
          video_versions: [{
            type: 101,
            url: 'https://scontent.cdninstagram.com/reel.mp4?token=modern&amp;expires=456',
          }],
        }],
      },
    });
    const html = `<script type="application/json">${payload}</script>`;

    expect(parseInstagramEmbedMedia(html)).toEqual({
      type: 'video',
      videoUrl: 'https://scontent.cdninstagram.com/reel.mp4?token=modern&expires=456',
      imageUrl: null,
    });
  });

  it('extracts the poster when Instagram withholds the video URL', () => {
    const payload = JSON.stringify({
      shortcode_media: {
        __typename: 'GraphVideo',
        is_video: true,
        display_url: 'https:\\/\\/scontent.cdninstagram.com\\/poster.jpg?token=example&amp;size=1080',
      },
    });
    const html = `<script>window.__data = ${JSON.stringify(payload)};</script>`;

    expect(parseInstagramEmbedMedia(html)).toEqual({
      type: 'video',
      videoUrl: null,
      imageUrl: 'https://scontent.cdninstagram.com/poster.jpg?token=example&size=1080',
    });
  });
});

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
  it('supports image-only sidecovers on either Rezka host', () => {
    expect(parseRezkaOriginalCover(
      `<section class="b-post__cover b-sidecover"><img data-src="/covers/series.webp"></section>`,
      new URL('https://hdrezka.me/series/comedy/story.html'),
    )).toBe('https://hdrezka.me/covers/series.webp');
  });

  it('ignores malformed or non-http cover links', () => {
    expect(parseRezkaOriginalCover(
      '<div class="b-sidecover"><a href="javascript:alert(1)"></a></div>',
      new URL('https://rezka.ag/films/story'),
    )).toBeNull();
  });
});

describe('parseSasflixVideoUrl', () => {
  it('builds the public HLS URL from a Sasflix topic poster', () => {
    const html = '<img src="https://sasflix.ru/api/poster/eb1ddca7-d933-4ccf-99b6-4129a4a6730e?w=1024">';
    expect(parseSasflixVideoUrl(
      html,
      new URL('https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea'),
    )).toBe('https://sasflix.ru/api/video/eb1ddca7-d933-4ccf-99b6-4129a4a6730e.m3u8');
  });

  it('does not expose poster identifiers from other hosts', () => {
    const html = '<img src="https://sasflix.ru/api/poster/eb1ddca7-d933-4ccf-99b6-4129a4a6730e">';
    expect(parseSasflixVideoUrl(html, new URL('https://example.com/topics/topic'))).toBeNull();
  });
});

describe('parseMatreshkaVideoUrl', () => {
  it('selects the highest-quality signed HLS stream', () => {
    const html = String.raw`<script>{"720":"https:\u002F\u002Fc4-video.cmtv.ru\u002Fhm\u002Fchannel\u002FdG9rZW4=\u002Fmaster.m3u8?expires=10\u0026md5=720","1080":"https:\u002F\u002Fc4-video.cmtv.ru\u002Fhm\u002Fchannel\u002FdG9rZW4=\u002Fmaster.m3u8?expires=10\u0026md5=1080"}</script>`;

    expect(parseMatreshkaVideoUrl(
      html,
      new URL('https://matreshka.tv/video/video'),
    )).toBe(
      'https://c4-video.cmtv.ru/hm/channel/dG9rZW4=/master.m3u8?expires=10&md5=1080',
    );
  });

  it('rejects stream URLs from untrusted hosts', () => {
    const html = '{"1080":"https://example.com/hm/channel/token/master.m3u8?expires=10&md5=x"}';
    expect(parseMatreshkaVideoUrl(
      html,
      new URL('https://matreshka.tv/video/video'),
    )).toBeNull();
  });
});

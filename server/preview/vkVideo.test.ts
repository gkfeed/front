import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { requestPublicHttp } from '../publicHttp.js';
import { fetchVkHtml } from './vkFetcher.js';
import { fetchVkVideoSource, fetchVkVideoStream } from './vkVideo.js';

vi.mock('../publicHttp.js', () => ({ requestPublicHttp: vi.fn() }));
vi.mock('./vkFetcher.js', () => ({ fetchVkHtml: vi.fn() }));

const context = {
  signal: new AbortController().signal,
  deadline: Number.POSITIVE_INFINITY,
  remainingMs: () => 8_000,
} satisfies RequestExecutionContext;

describe('VK video proxy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects the best stream up to 720p from a verified embed page', async () => {
    vi.mocked(fetchVkHtml).mockResolvedValue({
      html: `<script>var playerParams = {"params":[{
        "url360":"https://cdn.example/video-360.mp4",
        "url720":"https:\\/\\/cdn.example\\/video-720.mp4",
        "url1080":"https://cdn.example/video-1080.mp4"
      }]};</script>`,
      url: new URL('https://vk.ru/video_ext.php?oid=-1&id=2'),
    });

    await expect(fetchVkVideoSource(
      'https://vk.ru/video_ext.php?oid=-1&id=2&hash=secret',
      context,
    )).resolves.toEqual({
      url: 'https://cdn.example/video-720.mp4',
      referer: 'https://vk.ru/',
    });
  });

  it('rejects URLs outside the VK embed contract', async () => {
    await expect(fetchVkVideoSource('https://example.com/video.mp4', context))
      .rejects.toMatchObject({ kind: 'invalid_vk_video' });
    await expect(fetchVkVideoSource('https://vk.ru/video_ext.php?oid=nope&id=2', context))
      .rejects.toMatchObject({ kind: 'invalid_vk_video' });
    expect(fetchVkHtml).not.toHaveBeenCalled();
  });

  it('loads the reported recording HLS stream when the embed has no MP4', async () => {
    const embed = 'https://vk.ru/video_ext.php?oid=-45277565&id=456244225&hash=33b5252bdb6e927212';
    const hls = 'https://vkvd653.okcdn.ru/video.m3u8?expires=123&sig=signed';
    vi.mocked(fetchVkHtml)
      .mockResolvedValueOnce({ html: '<div id="video_ext_msg">Embed unavailable</div>', url: new URL(embed) })
      .mockResolvedValueOnce({
        html: `<video><source src="${hls.replaceAll('&', '&amp;')}" type="application/vnd.apple.mpegurl"></video>`,
        url: new URL('https://vkvideo.ru/video-45277565_456244225'),
      });

    await expect(fetchVkVideoSource(embed, context)).resolves.toEqual({ url: hls, referer: 'https://vkvideo.ru/' });
    expect(fetchVkHtml).toHaveBeenLastCalledWith(new URL('https://vk.ru/video-45277565_456244225'), context);
  });

  it('rejects an unavailable recording and an unrelated fallback source', async () => {
    vi.mocked(fetchVkHtml).mockResolvedValue({
      html: '<video><source type="application/vnd.apple.mpegurl" src="https://example.com/video.m3u8"></video>',
      url: new URL('https://vkvideo.ru/video-1_2'),
    });
    await expect(fetchVkVideoSource('https://vk.ru/video_ext.php?oid=-1&id=2', context))
      .rejects.toMatchObject({ kind: 'vk_video_unavailable' });
  });

  it('rewrites master and variant playlist URLs, including URI attributes', async () => {
    const master = 'https://vkvd653.okcdn.ru/video.m3u8?sig=signed';
    const variant = 'https://vkvd653.okcdn.ru/expires/123/sig/signed/video/';
    const key = `${variant}encryption.key`;
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce({
        body: Readable.from([`#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\n${new URL(variant).pathname}\n`]),
        headers: { 'content-type': 'application/x-mpegURL' }, status: 200,
      } as never)
      .mockResolvedValueOnce({
        body: Readable.from([`#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="encryption.key"\n#EXTINF:6\nMEDIUM00000.ts\n`]),
        headers: { 'content-type': 'application/x-mpegURL' }, status: 200,
      } as never);

    for (const [url, resources] of [[master, [variant]], [variant, [key, `${variant}MEDIUM00000.ts`]]] as const) {
      const source = await fetchVkVideoSource(url, context);
      const media = await fetchVkVideoStream(source, undefined, context);
      expect(media.contentType).toBe('application/vnd.apple.mpegurl');
      let playlist = '';
      for await (const chunk of media.body) playlist += chunk.toString();
      for (const resource of resources) expect(playlist).toContain(`/bff/vk-video?url=${encodeURIComponent(resource)}`);
      expect(media.contentLength).toBe(String(Buffer.byteLength(playlist)));
    }
    expect(fetchVkHtml).not.toHaveBeenCalled();
  });

  it.each([
    'https://vkvd653.okcdn.ru.evil.example/video.m3u8',
    'https://vkvd653.okcdn.ru/private/file',
    'http://vkvd653.okcdn.ru/video.m3u8',
    'https://user:pass@vkvd653.okcdn.ru/video.m3u8',
    'https://vkvd653.okcdn.ru:8443/video.m3u8',
    'http://127.0.0.1/video.m3u8',
  ])('rejects HLS inputs outside the CDN contract: %s', async (url) => {
    await expect(fetchVkVideoSource(url, context)).rejects.toThrow();
    expect(fetchVkHtml).not.toHaveBeenCalled();
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('rejects playlist resources outside the CDN contract', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from(['#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key"\n']),
      headers: { 'content-type': 'application/x-mpegurl' }, status: 200,
    } as never);
    await expect(fetchVkVideoStream({
      url: 'https://vkvd653.okcdn.ru/video.m3u8', referer: 'https://vkvideo.ru/',
    }, undefined, context)).rejects.toMatchObject({ kind: 'invalid_vk_video' });
  });

  it('bounds playlist size', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from(['#EXTM3U\n', 'x'.repeat(1_000_000)]),
      headers: { 'content-type': 'application/x-mpegurl' }, status: 200,
    } as never);
    await expect(fetchVkVideoStream({
      url: 'https://vkvd653.okcdn.ru/video.m3u8', referer: 'https://vkvideo.ru/',
    }, undefined, context)).rejects.toMatchObject({ kind: 'response_too_large' });
  });

  it('forwards byte ranges and the VK referer to the media CDN', async () => {
    const upstream = {
      body: { destroy: vi.fn() },
      headers: {
        'accept-ranges': 'bytes',
        'content-length': '1024',
        'content-range': 'bytes 1024-2047/4096',
        'content-type': 'video/mp4',
      },
      status: 206,
    };
    vi.mocked(requestPublicHttp).mockResolvedValue(upstream as never);

    await expect(fetchVkVideoStream({
      url: 'https://cdn.example/video.mp4',
      referer: 'https://vk.ru/',
    }, 'bytes=1024-2047', context)).resolves.toMatchObject({
      acceptRanges: 'bytes',
      contentLength: '1024',
      contentRange: 'bytes 1024-2047/4096',
      contentType: 'video/mp4',
      status: 206,
    });

    expect(requestPublicHttp).toHaveBeenCalledWith(
      new URL('https://cdn.example/video.mp4'),
      expect.objectContaining({
        range: 'bytes=1024-2047',
        referer: 'https://vk.ru/',
      }),
      context,
      { streamBody: true },
    );
  });

  it('rejects malformed byte ranges before contacting the CDN', async () => {
    await expect(fetchVkVideoStream({
      url: 'https://cdn.example/video.mp4',
      referer: 'https://vk.ru/',
    }, 'items=0-10', context)).rejects.toMatchObject({ kind: 'invalid_range' });
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });
});

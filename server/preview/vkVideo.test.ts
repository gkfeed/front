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

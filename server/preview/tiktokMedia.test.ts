import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { requestPublicHttp } from '../publicHttp.js';
import { fetchTikTokMedia } from './tiktokMedia.js';

vi.mock('../publicHttp.js', () => ({ requestPublicHttp: vi.fn() }));

describe('TikTok media proxy', () => {
  const context = createDetachedRequestExecutionContext();
  it('forwards byte ranges and streaming response headers', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce({
      body: Readable.from(['video']) as never, status: 206,
      headers: { 'content-type': 'video/mp4', 'content-length': '5', 'content-range': 'bytes 0-4/10' },
      url: new URL('https://v.tiktokcdn.com/video.mp4'),
    });
    const result = await fetchTikTokMedia('https://v.tiktokcdn.com/video.mp4', 'bytes=0-4', context);
    expect(requestPublicHttp).toHaveBeenCalledWith(expect.any(URL), { range: 'bytes=0-4' }, context, { streamBody: true });
    expect(result).toMatchObject({ status: 206, contentType: 'video/mp4', contentLength: '5', contentRange: 'bytes 0-4/10' });
  });
  it('rejects untrusted URLs and malformed ranges before fetching', async () => {
    await expect(fetchTikTokMedia('https://tiktokcdn.com.evil.test/video', undefined, context)).rejects.toThrow();
    await expect(fetchTikTokMedia('https://v.tiktokcdn.com/video', 'bytes=0-1,2-3', context)).rejects.toThrow();
  });
});

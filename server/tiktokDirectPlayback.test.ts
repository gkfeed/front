import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPublicHttp } from './publicHttp.js';
import { fetchTikTokDirectPlayback, getTikTokMediaCookie } from './tiktokDirectPlayback.js';
import { fetchTikTokMedia } from './preview/tiktokMedia.js';
import { createDetachedRequestExecutionContext } from './application/requestExecutionContext.js';

vi.mock('./publicHttp.js', async (original) => ({
  ...await original<typeof import('./publicHttp.js')>(), requestPublicHttp: vi.fn(),
}));

const post = new URL('https://www.tiktok.com/@test/video/123');
const mediaUrl = 'https://v16-webapp-prime.tiktok.com/video.mp4?signature=abc';
const context = createDetachedRequestExecutionContext();
function page(item: unknown, cookie = 'tt_chain_token=abc+/==; Path=/; Secure') {
  const state = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: item } } } };
  return {
    body: Readable.from([`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(state)}</script>`]) as never,
    headers: { 'set-cookie': [cookie] }, status: 200, url: post,
  };
}
const item = { id: '123', video: { bitrateInfo: [{ CodecType: 'h264', PlayAddr: { UrlList: [mediaUrl] } }] },
  author: { nickname: 'Author', uniqueId: 'test', avatarThumb: 'https://p.tiktokcdn.com/avatar' } };
afterEach(() => vi.clearAllMocks());

describe('direct TikTok playback', () => {
  it('passes the anonymous session only to the exact validated media URL', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page(item)).mockResolvedValueOnce({
      body: Readable.from(['v']) as never, status: 206, headers: { 'content-type': 'video/mp4' }, url: new URL(mediaUrl),
    });
    const preview = await fetchTikTokDirectPlayback(post, context);
    expect(preview).toMatchObject({ videoUrl: mediaUrl, author: { name: 'Author', username: 'test' } });
    expect(getTikTokMediaCookie(mediaUrl)).toBe('tt_chain_token=abc+/==');
    expect(getTikTokMediaCookie(`${mediaUrl}x`)).toBeUndefined();
    vi.mocked(requestPublicHttp).mockResolvedValueOnce({
      body: Readable.from(['video']) as never, status: 206, headers: { 'content-type': 'video/mp4' }, url: new URL(mediaUrl),
    });
    await fetchTikTokMedia(mediaUrl, 'bytes=0-4', context);
    expect(requestPublicHttp).toHaveBeenLastCalledWith(new URL(mediaUrl), expect.objectContaining({
      cookie: 'tt_chain_token=abc+/==', range: 'bytes=0-4', referer: 'https://www.tiktok.com/',
    }), context, { streamBody: true });
    await expect(fetchTikTokMedia('https://v16-webapp-prime.tiktok.com/other', undefined, context)).rejects.toThrow('session expired');
  });

  it('uses another TikTok media host when the first stream rejects the session', async () => {
    const alternate = 'https://v19-webapp-prime.tiktok.com/video.mp4?signature=abc';
    const withAlternate = { ...item, video: { bitrateInfo: [
      { CodecType: 'h264', PlayAddr: { UrlList: [mediaUrl, alternate] } },
    ] } };
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page(withAlternate))
      .mockResolvedValueOnce({ body: Readable.from([]) as never, status: 403, headers: {}, url: new URL(mediaUrl) })
      .mockResolvedValueOnce({ body: Readable.from(['v']) as never, status: 206,
        headers: { 'content-type': 'video/mp4' }, url: new URL(alternate) });
    await expect(fetchTikTokDirectPlayback(post, context)).resolves.toMatchObject({ videoUrl: alternate });
    expect(getTikTokMediaCookie(alternate)).toBe('tt_chain_token=abc+/==');
  });

  it.each([
    { ...item, id: '999' },
    { ...item, imagePost: { images: [] } },
    { ...item, video: { bitrateInfo: [{ CodecType: 'h264', PlayAddr: { UrlList: ['https://evil.test/video'] } }] } },
    { ...item, video: { bitrateInfo: [{ CodecType: 'h265', PlayAddr: { UrlList: [mediaUrl] } }] } },
  ])('falls back when the page does not provide the requested supported video', async (invalid) => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page(invalid));
    await expect(fetchTikTokDirectPlayback(post, context)).resolves.toBeNull();
  });

  it('keeps the request on TikTok even when the supplied path starts with two slashes', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page({ ...item, imagePost: {} }));
    await fetchTikTokDirectPlayback(new URL('https://www.tiktok.com//evil.test/video/123'), context);
    const target = vi.mocked(requestPublicHttp).mock.calls[0]![0];
    expect(target.hostname).toBe('www.tiktok.com');
    expect(target.pathname).toBe('//evil.test/video/123');
  });

  it('requires a valid anonymous session cookie', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page(item, 'other=value; Path=/'));
    await expect(fetchTikTokDirectPlayback(post, context)).resolves.toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTikTokJson } from './tiktokJson.js';
import { fetchTikTokPlayback } from './tiktokPlayback.js';
import { fetchTikTokDirectPlayback } from './tiktokDirectPlayback.js';
import { PreviewError } from './preview/errors.js';
import { PublicHttpError } from './publicHttpError.js';

vi.mock('./tiktokJson.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./tiktokJson.js')>(),
  fetchTikTokJson: vi.fn(),
}));
vi.mock('./tiktokDirectPlayback.js', () => ({ fetchTikTokDirectPlayback: vi.fn().mockResolvedValue(null) }));
const post = 'https://www.tiktok.com/@rus_goest/video/7681860124163476754';
const videoUrl = 'https://v16m.tiktokcdn-us.com/video.mp4?signature=temporary';
afterEach(() => vi.resetAllMocks());

describe('TikTok playback resolver', () => {
  it('does not wait for TikWM after TikTok explicitly restricts a post', async () => {
    vi.mocked(fetchTikTokDirectPlayback).mockRejectedValueOnce(new PreviewError('not accessible', 'tiktok_post_unavailable'));
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_post_unavailable' });
    expect(fetchTikTokJson).not.toHaveBeenCalled();
  });

  it('includes author details from the same provider response and rejects unsafe avatar URLs', async () => {
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: 0, data: {
      play: videoUrl,
      author: { nickname: 'АНАСТЕЙДЖИ💋', unique_id: 'anastejj', avatar: 'https://example.com/avatar.jpg' },
    } } });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ videoUrl, author: {
      name: 'АНАСТЕЙДЖИ💋', username: 'anastejj', avatarUrl: 'https://example.com/avatar.jpg',
    } });
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: 0, data: {
      play: videoUrl, author: { avatar: 'javascript:alert(1)' },
    } } });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ videoUrl, author: {
      name: null, username: null, avatarUrl: null,
    } });
  });

  it('preserves slideshow images even when play contains only the soundtrack', async () => {
    const imageUrls = ['https://p16.tiktokcdn.com/one.jpeg', 'https://p16.tiktokcdn.com/two.jpeg'];
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: 0, data: {
      play: videoUrl, images: imageUrls,
    } } });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ videoUrl, imageUrls });
  });

  it('supports photo posts without a playable soundtrack and filters unsafe images', async () => {
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: 0, data: {
      images: ['https://p16.tiktokcdn.com/one.jpeg', 'javascript:alert(1)'],
    } } });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({
      imageUrls: ['https://p16.tiktokcdn.com/one.jpeg'],
    });
  });

  it('returns a validated direct video without requesting comments', async () => {
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: 0, data: { play: videoUrl } } });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ videoUrl });
    expect(fetchTikTokJson).toHaveBeenCalledTimes(1);
    const upstream = vi.mocked(fetchTikTokJson).mock.calls[0][0];
    expect(upstream.origin).toBe('https://www.tikwm.com');
    expect(upstream.searchParams.get('url')).toBe(post);
  });

  it.each([
    null, { code: -1 }, { code: 0, data: {} },
    ...['http://v.tiktokcdn.com/video', 'https://tiktokcdn.com.evil.test/video',
      'https://localhost/video', 'https://user:pass@v.tiktokcdn.com/video', 'javascript:alert(1)']
      .map((play) => ({ code: 0, data: { play } })),
  ])('rejects unavailable or unsafe media: %j', async (value) => {
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value });
    await expect(fetchTikTokPlayback(post)).rejects.toThrow('TikTok video is unavailable');
  });

  it.each([
    ['timeout', 'tiktok_upstream_timeout'],
    ['network', 'tiktok_upstream_unavailable'],
  ] as const)('classifies provider %s errors', async (reason, kind) => {
    vi.mocked(fetchTikTokJson).mockRejectedValue(new PublicHttpError(reason));
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind });
  });

  it('identifies unsuccessful provider responses separately from malformed data', async () => {
    vi.mocked(fetchTikTokJson).mockResolvedValueOnce(null).mockResolvedValueOnce({ value: { code: -1 } });
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_upstream_unavailable' });
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_upstream_rejected' });
  });

  it('distinguishes TikWM throttling from invalid playback details', async () => {
    vi.mocked(fetchTikTokJson).mockResolvedValue({ value: { code: -1, msg: 'Free Api Limit: try again later' } });
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_rate_limited' });
  });

  it('rejects non-TikTok inputs before calling the provider', async () => {
    await expect(fetchTikTokPlayback('https://example.com/video/123')).rejects.toThrow();
    expect(fetchTikTokJson).not.toHaveBeenCalled();
  });
});

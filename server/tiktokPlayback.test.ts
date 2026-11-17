import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPublicHttp } from './publicHttp.js';
import { fetchTikTokPlayback } from './tiktokPlayback.js';
import { fetchTikTokDirectPlayback } from './tiktokDirectPlayback.js';
import { PreviewError } from './preview/errors.js';
import { PublicHttpError } from './publicHttpError.js';
import { createBffResultCache } from './http/bffResultCache.js';

vi.mock('./publicHttp.js', async (original) => ({ ...await original<typeof import('./publicHttp.js')>(), requestPublicHttp: vi.fn() }));
vi.mock('./tiktokDirectPlayback.js', () => ({ fetchTikTokDirectPlayback: vi.fn().mockResolvedValue(null) }));
const post = 'https://www.tiktok.com/@rus_goest/video/7681860124163476754';
const videoUrl = 'https://v16m.tiktokcdn-us.com/video.mp4?signature=temporary';
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });

describe('TikTok playback resolver', () => {
  it('keeps the fast path to one direct request and clears its recovery timer', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokDirectPlayback).mockResolvedValue({ videoUrl });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ videoUrl });
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledOnce();
    expect(requestPublicHttp).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('recovers a stalled direct request after 750 ms without waiting for the original timeout', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokDirectPlayback)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ videoUrl });
    const result = fetchTikTokPlayback(post);
    await vi.advanceTimersByTimeAsync(749);
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledOnce();
    const firstSignal = vi.mocked(fetchTikTokDirectPlayback).mock.calls[0]![1]!.signal;
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toEqual({ videoUrl });
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(2);
    expect(firstSignal.aborted).toBe(true);
    expect(requestPublicHttp).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares recovery between prefetch and the player when the prefetch subscriber leaves', async () => {
    vi.useFakeTimers();
    const cache = createBffResultCache();
    const prefetch = new AbortController();
    const foreground = new AbortController();
    const contextFor = (signal: AbortSignal) => ({ signal, deadline: Infinity, remainingMs: (maximum = Infinity) => maximum });
    vi.mocked(fetchTikTokDirectPlayback)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce({ videoUrl });
    const load = vi.fn((context) => fetchTikTokPlayback(post, context));
    const speculative = cache.load(post, load, { context: contextFor(prefetch.signal), ttlMs: 0 });
    const player = cache.load(post, load, { context: contextFor(foreground.signal), ttlMs: 0 });
    const rejected = expect(speculative).rejects.toThrow('Request aborted');
    await vi.advanceTimersByTimeAsync(100);
    prefetch.abort();
    await rejected;
    expect(vi.mocked(fetchTikTokDirectPlayback).mock.calls[0]![1]!.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(650);
    await expect(player).resolves.toEqual({ videoUrl });
    expect(load).toHaveBeenCalledOnce();
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('immediately retries an empty direct response using only TikTok', async () => {
    vi.useFakeTimers();
    const imageUrls = ['https://p16.tiktokcdn.com/one.jpeg'];
    vi.mocked(fetchTikTokDirectPlayback).mockResolvedValueOnce(null).mockResolvedValueOnce({ imageUrls });
    await expect(fetchTikTokPlayback(post)).resolves.toEqual({ imageUrls });
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still accepts the original direct response if the recovery attempt fails', async () => {
    vi.useFakeTimers();
    let complete!: (value: { videoUrl: string }) => void;
    vi.mocked(fetchTikTokDirectPlayback)
      .mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }))
      .mockRejectedValueOnce(new PublicHttpError('network'));
    const result = fetchTikTokPlayback(post);
    await vi.advanceTimersByTimeAsync(750);
    expect(requestPublicHttp).not.toHaveBeenCalled();
    complete({ videoUrl });
    await expect(result).resolves.toEqual({ videoUrl });
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(2);
  });

  it('stops after two failed direct attempts without contacting another provider', async () => {
    vi.mocked(fetchTikTokDirectPlayback).mockResolvedValue(null);
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_upstream_unavailable' });
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it.each([100, 800])('cancels all direct work on disconnect at %i ms', async (disconnectAt) => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokDirectPlayback).mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const result = fetchTikTokPlayback(post, {
      signal: controller.signal, deadline: Infinity, remainingMs: (maximum = Infinity) => maximum,
    });
    const rejected = expect(result).rejects.toMatchObject({ kind: 'tiktok_upstream_unavailable' });
    await vi.advanceTimersByTimeAsync(disconnectAt);
    controller.abort();
    await rejected;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchTikTokDirectPlayback).toHaveBeenCalledTimes(disconnectAt < 750 ? 1 : 2);
    expect(vi.mocked(fetchTikTokDirectPlayback).mock.calls.every(([, context]) => context!.signal.aborted)).toBe(true);
    expect(requestPublicHttp).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('honors explicit restrictions from recovery and cancels the stalled original', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokDirectPlayback)
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockRejectedValueOnce(new PreviewError('not accessible', 'tiktok_post_unavailable'));
    const result = fetchTikTokPlayback(post);
    const rejected = expect(result).rejects.toMatchObject({ kind: 'tiktok_post_unavailable' });
    await vi.advanceTimersByTimeAsync(750);
    await rejected;
    expect(requestPublicHttp).not.toHaveBeenCalled();
    expect(vi.mocked(fetchTikTokDirectPlayback).mock.calls[0]![1]!.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops immediately when TikTok explicitly restricts a post', async () => {
    vi.mocked(fetchTikTokDirectPlayback).mockRejectedValueOnce(new PreviewError('not accessible', 'tiktok_post_unavailable'));
    await expect(fetchTikTokPlayback(post)).rejects.toMatchObject({ kind: 'tiktok_post_unavailable' });
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('rejects non-TikTok inputs before calling the provider', async () => {
    await expect(fetchTikTokPlayback('https://example.com/video/123')).rejects.toThrow();
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffHttpError } from './bffClient';
import { fetchTikTokPlayback } from './tiktokPlayback';
import { prefetchTikTok } from './tiktokPrefetch';

vi.mock('./tiktokPlayback');
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); });

describe('TikTok media prefetch', () => {
  it('starts a muted video preload and releases it on disposal', async () => {
    const create = vi.spyOn(document, 'createElement');
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl: 'https://v.tiktokcdn.com/123.mp4' });
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/123');
    await vi.waitFor(() => expect(create).toHaveBeenCalledWith('video'));
    const video = create.mock.results.find((r) => r.value instanceof HTMLVideoElement)!.value as HTMLVideoElement;
    expect(video.preload).toBe('auto');
    expect(video.muted).toBe(true);
    expect(video.getAttribute('src')).toBe(`/bff/tiktok-media?url=${encodeURIComponent('https://v.tiktokcdn.com/123.mp4')}`);
    dispose();
    expect(video.hasAttribute('src')).toBe(false);
    expect(load).toHaveBeenCalled();
  });

  it('retries a transient failure once while the item is still upcoming', async () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.mocked(fetchTikTokPlayback)
      .mockRejectedValueOnce(new BffHttpError('unavailable', 502, '/bff/tiktok-playback'))
      .mockResolvedValueOnce({ videoUrl: 'https://v.tiktokcdn.com/retry.mp4' });
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/789');
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchTikTokPlayback).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('cancels a pending retry when the item leaves the queue', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockRejectedValue(new BffHttpError('unavailable', 502, '/bff/tiktok-playback'));
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/790');
    await Promise.resolve();
    await Promise.resolve();
    dispose();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetchTikTokPlayback).toHaveBeenCalledTimes(1);
  });

  it('does not start media after the speculative request is cancelled', async () => {
    let complete!: (value: { videoUrl: string }) => void;
    vi.mocked(fetchTikTokPlayback).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const create = vi.spyOn(document, 'createElement');
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/456');
    dispose();
    complete({ videoUrl: 'https://v.tiktokcdn.com/456.mp4' });
    await Promise.resolve();
    expect(create).not.toHaveBeenCalledWith('video');
  });
});

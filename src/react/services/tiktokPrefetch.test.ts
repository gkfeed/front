// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTikTokPlayback } from './tiktokPlayback';
import { prefetchTikTok } from './tiktokPrefetch';

vi.mock('./tiktokPlayback');
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); });

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
    expect(video.src).toBe('https://v.tiktokcdn.com/123.mp4');
    dispose();
    expect(video.hasAttribute('src')).toBe(false);
    expect(load).toHaveBeenCalled();
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

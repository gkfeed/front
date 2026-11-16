// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffHttpError } from './bffClient';
import { fetchTikTokPlayback } from './tiktokPlayback';
import { prefetchTikTok } from './tiktokPrefetch';

vi.mock('./tiktokPlayback');
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); });

describe('TikTok media prefetch', () => {
  it('limits speculative video transfer and cancels it on disposal', async () => {
    let signal: AbortSignal | undefined;
    const cancel = vi.fn().mockResolvedValue(undefined);
    const reader = { read: vi.fn().mockResolvedValue({ done: true }), cancel };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      signal = init?.signal as AbortSignal;
      return { status: 206, headers: new Headers({ 'content-range': 'bytes 0-1023/2048' }), body: { getReader: () => reader } } as unknown as Response;
    });
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl: 'https://v.tiktokcdn.com/123.mp4' });
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/123');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/bff/tiktok-media?'), expect.objectContaining({
      headers: { Range: 'bytes=0-1048575' },
    }));
    dispose();
    expect(signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  });

  it('cancels without reading if the server ignores the range', async () => {
    const reader = { read: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined) };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, headers: new Headers(),
      body: { getReader: () => reader } } as unknown as Response);
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl: 'https://v.tiktokcdn.com/123.mp4' });
    const dispose = prefetchTikTok('https://www.tiktok.com/@creator/video/123');
    await vi.waitFor(() => expect(reader.cancel).toHaveBeenCalledOnce());
    expect(reader.read).not.toHaveBeenCalled();
    dispose();
  });

  it('retries a transient failure once while the item is still upcoming', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
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

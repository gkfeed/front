import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBffJson } from './bffClient';
import { fetchTikTokPlayback } from './tiktokPlayback';

vi.mock('./bffClient', () => ({ requestBffJson: vi.fn() }));
afterEach(() => vi.resetAllMocks());

describe('TikTok playback prefetch sharing', () => {
  it('keeps a shared request alive when the speculative subscriber leaves', async () => {
    let complete!: (value: unknown) => void;
    vi.mocked(requestBffJson).mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const prefetch = new AbortController();
    const visible = new AbortController();
    const url = 'https://www.tiktok.com/@test/video/1101';
    const speculative = fetchTikTokPlayback(url, prefetch.signal);
    const foreground = fetchTikTokPlayback(url, visible.signal);
    expect(requestBffJson).toHaveBeenCalledTimes(1);
    const requestSignal = vi.mocked(requestBffJson).mock.calls[0]![0].signal!;
    prefetch.abort();
    await expect(speculative).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal.aborted).toBe(false);
    const value = { videoUrl: 'https://v.tiktokcdn.com/test.mp4' };
    complete(value);
    await expect(foreground).resolves.toEqual(value);
    await expect(fetchTikTokPlayback(url, new AbortController().signal)).resolves.toEqual(value);
    expect(requestBffJson).toHaveBeenCalledTimes(1);
  });

  it('aborts abandoned work and starts a fresh request on return', async () => {
    vi.mocked(requestBffJson).mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const url = 'https://www.tiktok.com/@test/video/1102';
    const result = fetchTikTokPlayback(url, controller.signal);
    const requestSignal = vi.mocked(requestBffJson).mock.calls[0]![0].signal!;
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(requestSignal.aborted).toBe(true);
    const retry = new AbortController();
    const next = fetchTikTokPlayback(url, retry.signal);
    expect(requestBffJson).toHaveBeenCalledTimes(2);
    retry.abort();
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
  });
});

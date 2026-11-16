import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestBffJson } from './bffClient';
import { createBffRequestGate } from '../../../server/http/bffRequestGate';
import { clearPreviewCache, loadQueuedPreview } from './previewQueue';
import { fetchTikTokPlayback } from './tiktokPlayback';

vi.mock('./bffClient', () => ({ requestBffJson: vi.fn() }));
afterEach(() => { clearPreviewCache(); vi.useRealTimers(); vi.resetAllMocks(); });

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

  it('reuses prefetched metadata after ten seconds and expires it after thirty', async () => {
    vi.useFakeTimers();
    const url = 'https://www.tiktok.com/@test/video/1103';
    const value = { videoUrl: 'https://v.tiktokcdn.com/test.mp4' };
    vi.mocked(requestBffJson).mockResolvedValue(value);
    await fetchTikTokPlayback(url, new AbortController().signal);
    vi.advanceTimersByTime(15_000);
    await fetchTikTokPlayback(url, new AbortController().signal);
    expect(requestBffJson).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_000);
    await fetchTikTokPlayback(url, new AbortController().signal);
    expect(requestBffJson).toHaveBeenCalledTimes(2);
  });

  it('allows a visible TikTok to enter the BFF while generic prefetch is stalled', async () => {
    const gate = createBffRequestGate();
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const run = <T>(name: string, signal: AbortSignal, value: T) => gate.run(
      'same-client', { signal, deadline: Infinity, remainingMs: () => Infinity },
      () => new Promise<T>((resolve) => { started.push(name); releases.push(() => resolve(value)); }),
    );
    const backgrounds = [1, 2].map((index) => loadQueuedPreview(
      `generic-${index}`, (signal) => run(`generic-${index}`, signal, 'ready'), undefined, index,
    ).catch(() => undefined));
    await vi.waitFor(() => expect(started).toEqual(['generic-1']));
    const videoUrl = 'https://v.tiktokcdn.com/video.mp4';
    vi.mocked(requestBffJson).mockImplementation(({ signal }) => run('tiktok', signal!, { videoUrl }) as never);
    const visible = fetchTikTokPlayback('https://www.tiktok.com/@test/video/1104', new AbortController().signal);
    expect(started).toEqual(['generic-1', 'tiktok']);
    releases[1]!();
    await expect(visible).resolves.toEqual({ videoUrl });
    clearPreviewCache();
    releases.forEach((release) => release());
    await Promise.all(backgrounds);
  });

  it('allows a visible generic preview to enter while a TikTok prefetch is stalled', async () => {
    const gate = createBffRequestGate();
    const started: string[] = [];
    const releases: Array<() => void> = [];
    const run = <T>(name: string, signal: AbortSignal, value: T) => gate.run(
      'same-client', { signal, deadline: Infinity, remainingMs: () => Infinity },
      () => new Promise<T>((resolve) => { started.push(name); releases.push(() => resolve(value)); }),
    );
    vi.mocked(requestBffJson).mockImplementation(({ signal }) => run('tiktok-prefetch', signal!, {
      videoUrl: 'https://v.tiktokcdn.com/video.mp4',
    }) as never);
    const prefetch = fetchTikTokPlayback('https://www.tiktok.com/@test/video/1105', new AbortController().signal, 2);
    await vi.waitFor(() => expect(started).toEqual(['tiktok-prefetch']));
    const visible = loadQueuedPreview('generic-visible', (signal) => run('generic-visible', signal, 'ready'));
    expect(started).toEqual(['tiktok-prefetch', 'generic-visible']);
    releases.forEach((release) => release());
    await Promise.all([prefetch, visible]);
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

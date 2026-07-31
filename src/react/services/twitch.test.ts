// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFeedItems } from './feeds';
import { getLiveTwitchItems, isTwitchStreamLive } from './twitch';

vi.mock('./feeds');

const CREDENTIALS = { username: 'reader', password: 'secret' };
const TWITCH_ITEM = {
  id: 10,
  feedId: 2,
  link: 'https://www.twitch.tv/some_channel',
  title: 'Some channel is live',
  text: '',
};

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('Twitch live service', () => {
  it('treats a direct Twitch preview response as live', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_some_channel-440x248.jpg',
    }));

    await expect(isTwitchStreamLive(TWITCH_ITEM)).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/live_user_some_channel-440x248\.jpg\?gkfeed-live-check=\d+/),
      {
        cache: 'no-store',
        redirect: 'follow',
        signal: expect.any(AbortSignal),
      },
    );
  });

  it('recognizes Twitch’s redirected offline placeholder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      url: 'https://static-cdn.jtvnw.net/ttv-static/404_preview-440x248.jpg',
    }));

    await expect(isTwitchStreamLive(TWITCH_ITEM)).resolves.toBe(false);
  });

  it('returns only Twitch items whose preview is live', async () => {
    const offlineItem = {
      ...TWITCH_ITEM,
      id: 11,
      link: 'https://twitch.tv/offline_channel',
    };
    vi.mocked(getFeedItems).mockResolvedValue([
      TWITCH_ITEM,
      offlineItem,
      { ...TWITCH_ITEM, id: 12, link: 'https://example.com/story' },
    ]);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_some_channel-440x248.jpg',
      })
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://static-cdn.jtvnw.net/ttv-static/404_preview-440x248.jpg',
      }));

    await expect(getLiveTwitchItems(CREDENTIALS)).resolves.toEqual([TWITCH_ITEM]);
    expect(getFeedItems).toHaveBeenCalledWith(CREDENTIALS);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a failed Twitch check as offline', async () => {
    const secondItem = { ...TWITCH_ITEM, id: 11, link: 'https://twitch.tv/working_channel' };
    vi.mocked(getFeedItems).mockResolvedValue([TWITCH_ITEM, secondItem]);
    vi.stubGlobal('fetch', vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({
        ok: true,
        url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_working_channel-440x248.jpg',
      }));

    await expect(getLiveTwitchItems(CREDENTIALS)).resolves.toEqual([secondItem]);
  });

  it('releases a probe when the caller aborts a pending request', async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted', 'AbortError'));
        }, { once: true });
      });
    }));

    const request = isTwitchStreamLive(TWITCH_ITEM, controller.signal);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).resolves.toBe(false);
    expect(requestSignal?.aborted).toBe(true);
  });

  it('releases a probe when its timeout aborts a pending request', async () => {
    vi.useFakeTimers();
    try {
      let requestSignal: AbortSignal | undefined;
      vi.stubGlobal('fetch', vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'));
          }, { once: true });
        });
      }));

      const request = isTwitchStreamLive(TWITCH_ITEM);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(10_000);

      await expect(request).resolves.toBe(false);
      expect(requestSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('checks no more than four Twitch channels concurrently', async () => {
    const twitchItems = Array.from({ length: 6 }, (_, index) => ({
      ...TWITCH_ITEM,
      id: index,
      link: `https://twitch.tv/channel_${index}`,
    }));
    const releases: Array<() => void> = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;
    vi.mocked(getFeedItems).mockResolvedValue(twitchItems);
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      releases.push(() => {
        activeRequests -= 1;
        resolve({
          ok: true,
          url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_channel-440x248.jpg',
        });
      });
    })));

    const request = getLiveTwitchItems(CREDENTIALS);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    expect(maxActiveRequests).toBe(4);

    releases.forEach((release) => release());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
    releases.slice(4).forEach((release) => release());

    await expect(request).resolves.toHaveLength(6);
    expect(maxActiveRequests).toBe(4);
  });
});

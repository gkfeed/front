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
});

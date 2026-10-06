import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveYoutubeChannel } from './youtubeChannel';
import { BffHttpError, BffResponseError } from './bffClient';

afterEach(() => vi.unstubAllGlobals());
const ID = 'UC5TRrMsWLy7flttFTyS-bOA';
const input = 'https://www.youtube.com/@sendependa_dio_games/videos?si=share';

describe('YouTube channel service', () => {
  it('requests server resolution and validates the returned permanent URL', async () => {
    const result = { channelId: ID, url: `https://www.youtube.com/channel/${ID}/videos` };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)));
    await expect(resolveYoutubeChannel(input)).resolves.toEqual(result);
    expect(fetch).toHaveBeenCalledWith(`/bff/youtube-channel?url=${encodeURIComponent(input)}`, {
      signal: expect.any(AbortSignal),
    });
  });

  it.each([
    { channelId: 'guess', url: `https://www.youtube.com/channel/${ID}/videos` },
    { channelId: ID, url: 'https://www.youtube.com/@sendependa_dio_games/videos' },
    { channelId: ID, url: `https://evil.test/channel/${ID}/videos` },
    { channelId: ID, url: `https://www.youtube.com/channel/${ID}/shorts` },
    { channelId: ID, url: `https://www.youtube.com/channel/${ID}/videos?si=share` },
  ])('rejects malformed results or changes to the chosen tab', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)));
    await expect(resolveYoutubeChannel(input)).rejects.toBeInstanceOf(BffResponseError);
  });

  it('does not accept replacement of an already permanent channel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      channelId: 'UC0000000000000000000000', url: 'https://www.youtube.com/channel/UC0000000000000000000000/videos',
    })));
    await expect(resolveYoutubeChannel(`https://www.youtube.com/channel/${ID}/videos`))
      .rejects.toBeInstanceOf(BffResponseError);
  });

  it('propagates server errors without a fallback request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
    await expect(resolveYoutubeChannel(input)).rejects.toBeInstanceOf(BffHttpError);
    expect(fetch).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it } from 'vitest';
import { isYoutubeChannelResolution, parseYoutubeChannelUrl } from './youtubeChannel';

const ID = 'UC5TRrMsWLy7flttFTyS-bOA';

describe('YouTube channel URLs', () => {
  it.each(['', '/videos', '/shorts', '/streams'])('recognizes handles, legacy names, and permanent URLs with %s', (tab) => {
    for (const locator of ['@sendependa_dio_games', 'c/example', 'user/example', `channel/${ID}`]) {
      expect(parseYoutubeChannelUrl(` https://m.youtube.com/${locator}${tab}/?si=share#top `))
        .toEqual({ channelId: locator.startsWith('channel/') ? ID : null, pageUrl: `https://www.youtube.com/${locator}`, tab });
    }
  });

  it.each([
    'https://youtube.com.evil.test/@example/videos',
    'https://www.youtube.com/watch?v=video',
    'https://youtu.be/video',
    'https://www.youtube.com/shorts/video',
    'https://www.youtube.com/playlist?list=PLtest',
    'https://www.youtube.com/channel/guess/videos',
    'https://www.youtube.com/@example/videos/extra',
    'https://www.youtube.com/@example%2Fvideos',
    'https://user:password@www.youtube.com/@example',
    'https://www.youtube.com:8000/@example',
    'ftp://www.youtube.com/@example',
    'not a URL',
  ])('excludes non-channel or unsafe input %s', (url) => {
    expect(parseYoutubeChannelUrl(url)).toBeNull();
  });

  it('validates the ID, canonical host, and URL together', () => {
    expect(isYoutubeChannelResolution({ channelId: ID, url: `https://www.youtube.com/channel/${ID}/videos` })).toBe(true);
    expect(isYoutubeChannelResolution({ channelId: ID, url: 'https://www.youtube.com/@example/videos' })).toBe(false);
    expect(isYoutubeChannelResolution({ channelId: ID, url: `https://evil.test/channel/${ID}/videos` })).toBe(false);
    expect(isYoutubeChannelResolution({ channelId: 'UC0000000000000000000000', url: `https://www.youtube.com/channel/${ID}` })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { toLiveStreamViewModel } from './liveViewModel';

describe('live stream view model', () => {
  it('normalizes channel, title, and local preview for the page', () => {
    const stream = toLiveStreamViewModel({
      id: 1,
      feedId: 2,
      link: 'https://www.twitch.tv/some_channel',
      title: 'some_channel: Tournament finals',
      text: '',
    });

    expect(stream.channel).toBe('some_channel');
    expect(stream.title).toBe('Tournament finals');
    expect(stream.preview?.src).toContain('live_user_some_channel');
  });

  it('falls back to the feed title for malformed links', () => {
    const stream = toLiveStreamViewModel({
      id: 1,
      feedId: 2,
      link: 'not-a-url',
      title: 'Offline channel',
      text: '',
    });

    expect(stream.channel).toBe('Offline channel');
    expect(stream.title).toBe('Offline channel');
  });
});

import { describe, expect, it } from 'vitest';

import { getPriorityReaderItemIds } from './readerItemPriority';

describe('reader time-sensitive items', () => {
  it('boosts stories and live providers without boosting regular posts from the same source', () => {
    const links = [
      'https://example.com/story.mp4',
      'https://www.twitch.tv/channel',
      'https://www.hltv.org/matches/12345/team-a-vs-team-b',
      'https://onefootball.com/en/match/12345',
      'https://www.hltv.org/news/12345/article',
      'https://www.instagram.com/p/example/',
    ];
    const items = links.map((link, index) => ({
      id: index + 1, feedId: index === 4 ? 3 : index + 1, link, title: '', text: '',
    }));

    expect([...getPriorityReaderItemIds(items, [
      { id: 1, type: ' Stories ', title: '', url: '' },
      { id: 6, type: 'inst', title: '', url: '' },
    ])]).toEqual([1, 2, 3, 4]);
  });
});

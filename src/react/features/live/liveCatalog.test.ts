import { describe, expect, it } from 'vitest';

import type { LiveEvent } from '../../domain/liveEvents';
import { deduplicateLiveEvents } from './liveCatalog';

describe('live event deduplication', () => {
  it('keeps one Twitch card when another title only adds stream tags', () => {
    const events = [
      twitchEvent(1, 'SPIRIT [0:0] FALCONS | BLAST Open Porto 2026 SF @strqqq @deko !betboom'),
      twitchEvent(2, 'SPIRIT [0:0] FALCONS | BLAST Open Porto 2026 SF'),
    ];

    expect(deduplicateLiveEvents(events).map((event) => event.candidate.eventId)).toEqual(['channel-1']);
  });

  it('normalizes title casing and whitespace', () => {
    const events = [
      twitchEvent(1, '  Tournament   Final  '),
      twitchEvent(2, 'tournament final'),
    ];

    expect(deduplicateLiveEvents(events)).toHaveLength(1);
  });

  it('does not deduplicate non-Twitch events by title', () => {
    const first = twitchEvent(1, 'Tournament final');
    const second: LiveEvent = {
      ...twitchEvent(2, 'Tournament final'),
      data: {
        kind: 'hltv',
        snapshot: {
          startsAt: null,
          teams: null,
          status: 'live',
          score: null,
          currentMap: null,
          completedMaps: null,
          roundHistory: null,
          playerStats: null,
          teamSides: null,
        },
      },
    };

    expect(deduplicateLiveEvents([first, second])).toHaveLength(2);
  });

  it('keeps streams whose normalized titles are empty', () => {
    expect(deduplicateLiveEvents([
      twitchEvent(1, ''),
      twitchEvent(2, '   '),
    ])).toHaveLength(2);
  });
});

function twitchEvent(index: number, title: string): LiveEvent {
  const channel = `channel-${index}`;
  return {
    candidate: {
      key: `twitch:${channel}`,
      providerId: 'twitch',
      eventId: channel,
      deduplicationKey: `twitch:${channel}`,
      feedOrder: index,
      item: {
        id: index,
        feedId: 1,
        link: `https://www.twitch.tv/${channel}`,
        title,
        text: '',
      },
    },
    data: { kind: 'twitch', channel, title },
    checkedAt: Date.now(),
  };
}

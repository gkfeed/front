import { describe, expect, it } from 'vitest';

import type { LiveCandidate, LiveEvent, LiveProviderRuntime } from '../../domain/liveEvents';
import { scheduleProviderCandidates } from './useLivePageModel';

const provider: LiveProviderRuntime = {
  id: 'test',
  category: { id: 'test', titleKey: 'test', order: 1, layout: 'grid' },
  strategy: 'round-robin',
  refreshIntervalMs: 60_000,
  dormantSweepCycles: 5,
  preserveEndedPlayback: false,
  recognize: () => null,
  check: async () => ({ updates: [], failures: 0 }),
};

describe('live refresh scheduling', () => {
  it('checks every active event and one fifth of dormant candidates per cycle', () => {
    const candidates = Array.from({ length: 75 }, (_, index) => candidate(index));
    const activeEvent: LiveEvent = {
      candidate: candidates[74]!,
      data: { kind: 'twitch', channel: 'active', title: 'Active' },
      checkedAt: Date.now(),
    };

    const scheduled = scheduleProviderCandidates(
      provider,
      candidates,
      { [activeEvent.candidate.key]: activeEvent },
      new Map(candidates.slice(0, 10).map((value, index) => [value.key, index + 1])),
    );

    expect(scheduled).toHaveLength(16);
    expect(scheduled[0]).toBe(activeEvent.candidate);
    expect(scheduled.slice(1).every((value) => value !== activeEvent.candidate)).toBe(true);
  });

  it('passes every candidate to a provider with a live index', () => {
    const candidates = Array.from({ length: 75 }, (_, index) => candidate(index));
    expect(scheduleProviderCandidates(
      { ...provider, strategy: 'live-index', dormantSweepCycles: 1 },
      candidates,
      {},
      new Map(),
    )).toEqual(candidates);
  });
});

function candidate(index: number): LiveCandidate {
  return {
    key: `test:${index}`,
    providerId: 'test',
    eventId: String(index),
    deduplicationKey: `test:${index}`,
    feedOrder: index,
    item: { id: index, feedId: 1, link: `https://example.com/${index}`, title: String(index), text: '' },
  };
}

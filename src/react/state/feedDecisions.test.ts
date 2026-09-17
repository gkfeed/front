import { describe, expect, it } from 'vitest';

import {
  MAX_FEED_DECISIONS,
  parseFeedDecisions,
  recordFeedDecision,
  type FeedDecision,
} from './feedDecisions';

const kept: FeedDecision = { itemId: 1, feedId: 2, kept: true };
const deleted: FeedDecision = { itemId: 2, feedId: 3, kept: false };

function createDecisions(count: number): FeedDecision[] {
  return Array.from({ length: count }, (_, index) => ({ ...kept, itemId: index + 1 }));
}

describe('recordFeedDecision', () => {
  it('preserves the array when the decision has not changed', () => {
    const decisions = [kept, deleted];

    expect(recordFeedDecision(decisions, { ...kept })).toBe(decisions);
  });

  it.each([
    { ...kept, kept: false },
    { ...kept, feedId: 4 },
  ])('replaces a changed decision and moves it to the end', (decision) => {
    const decisions = [kept, deleted];

    expect(recordFeedDecision(decisions, decision)).toEqual([deleted, decision]);
    expect(decisions).toEqual([kept, deleted]);
  });

  it('drops the oldest decision when the history is full', () => {
    const decisions = createDecisions(MAX_FEED_DECISIONS);
    const decision = { ...kept, itemId: MAX_FEED_DECISIONS + 1 };

    expect(recordFeedDecision(decisions, decision)).toEqual([...decisions.slice(1), decision]);
    expect(decisions).toHaveLength(MAX_FEED_DECISIONS);
  });
});

describe('parseFeedDecisions', () => {
  it.each([null, undefined, false, 1, '[]', {}])('rejects non-array input %j', (value) => {
    expect(parseFeedDecisions(value)).toEqual([]);
  });

  it('discards malformed entries and strips unknown fields', () => {
    const invalidIds = [undefined, null, '1', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
    const entries = [
      null, false, 1, 'decision', [], {},
      ...invalidIds.map((itemId) => ({ ...kept, itemId })),
      ...invalidIds.map((feedId) => ({ ...kept, feedId })),
      ...[undefined, null, 'true', 0, 1].map((value) => ({ ...kept, kept: value })),
      { ...kept, extra: 'ignored' },
      deleted,
    ];

    expect(parseFeedDecisions(entries)).toEqual([kept, deleted]);
  });

  it('keeps only the latest decision for each item in recency order', () => {
    const replacement = { ...kept, feedId: 4, kept: false };

    expect(parseFeedDecisions([kept, deleted, replacement])).toEqual([deleted, replacement]);
  });

  it('reads only the most recent history window', () => {
    const decisions = createDecisions(MAX_FEED_DECISIONS + 2);

    expect(parseFeedDecisions(decisions)).toEqual(decisions.slice(2));
  });
});

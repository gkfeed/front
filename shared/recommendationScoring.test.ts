import { describe, expect, it } from 'vitest';

import type { RecommendationEvent } from './recommendationEvents';
import { classifyRecommendationEvent, classifyRecommendationItems, scoreRecommendationFeeds } from './recommendationScoring';

function decision(id: number, action: 'keep' | 'delete', activeMs: number, overrides: Partial<RecommendationEvent> = {}): RecommendationEvent {
  return { schemaVersion: 1, eventId: `event-${id}`, subjectId: 'reader',
    occurredAt: '2026-11-13T12:00:00Z', action, activeMs,
    item: { id, feedId: 2, title: 'Item', text: '', link: 'https://example.com' }, ...overrides };
}

describe('three-category recommendation scoring', () => {
  it('classifies keep independently of time and includes exactly ten seconds as viewed', () => {
    expect(classifyRecommendationEvent(decision(1, 'keep', 0))).toBe('keep_for_later');
    expect(classifyRecommendationEvent(decision(1, 'keep', 60_000))).toBe('keep_for_later');
    expect(classifyRecommendationEvent(decision(1, 'delete', 9999))).toBe('delete_immediately');
    expect(classifyRecommendationEvent(decision(1, 'delete', 10_000))).toBe('delete_after_viewing');
    expect(classifyRecommendationEvent(decision(1, 'delete', 30_000))).toBe('delete_after_viewing');
  });

  it('counts a unique item once without choosing or replacing its decision', () => {
    const event = decision(1, 'keep', 100);
    const duplicate = { ...event, eventId: 'resent-with-another-id' };
    const items = classifyRecommendationItems([event, event, duplicate]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ category: 'keep_for_later', eventId: event.eventId, classificationVersion: 1 });
  });

  it('scores each subject and feed separately using unique items', () => {
    const events = [decision(1, 'keep', 100), decision(2, 'delete', 100), decision(3, 'delete', 10_000),
      decision(4, 'delete', 20_000), decision(1, 'delete', 0, { subjectId: 'other' }),
      decision(5, 'keep', 0, { item: { id: 5, feedId: 3, title: '', text: '', link: 'https://example.com' } })];
    events.push(events[0]);
    const scores = scoreRecommendationFeeds(events);
    const reader = scores.find((score) => score.subjectId === 'reader');
    expect(reader).toMatchObject({ feedId: 2, itemCount: 4, category: 'delete_after_viewing',
      counts: { keep_for_later: 1, delete_immediately: 1, delete_after_viewing: 2 },
      probabilities: { keep_for_later: 0.25, delete_immediately: 0.25, delete_after_viewing: 0.5 } });
    expect(scores.find((score) => score.subjectId === 'other')?.itemCount).toBe(1);
    expect(scores.find((score) => score.feedId === 3)).toMatchObject({ itemCount: 1, category: 'keep_for_later' });
  });

  it('returns no arbitrary winning category on a tie and no score without decisions', () => {
    expect(scoreRecommendationFeeds([])).toEqual([]);
    const scores = scoreRecommendationFeeds([decision(1, 'keep', 0), decision(2, 'delete', 0)]);
    expect(scores[0].category).toBeNull();
    expect(Object.values(scores[0].probabilities).reduce((a, b) => a + b, 0)).toBe(1);
  });
});

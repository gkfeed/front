import { describe, expect, it } from 'vitest';

import type { FeedItem } from '../types';
import type { FeedDecision } from './feedDecisions';
import {
  changeFeedPriority,
  DECISION_HALF_LIFE_MS,
  DECISION_HALF_LIFE_REVIEWS,
  getEffectiveFeedPriorities,
  orderFeedItems,
  parseFeedPriorities,
} from './feedPriority';

describe('feed priority', () => {
  it('halves decision weight after 30 days and returns stale feeds toward neutral', () => {
    const decidedAt = Date.UTC(2026, 0, 1);
    const decisions = [{ itemId: 1, feedId: 1, kept: true, decidedAt }];

    expect(getEffectiveFeedPriorities({}, decisions, decidedAt)[1]).toBeCloseTo(0.1);
    expect(getEffectiveFeedPriorities({}, decisions, decidedAt + DECISION_HALF_LIFE_MS)[1])
      .toBeCloseTo(2.5 / 4.5 - 0.5);
    expect(getEffectiveFeedPriorities({}, decisions, decidedAt + 20 * DECISION_HALF_LIFE_MS)[1])
      .toBeCloseTo(0, 6);
    expect(getEffectiveFeedPriorities({}, decisions, decidedAt - DECISION_HALF_LIFE_MS)[1])
      .toBeCloseTo(0.1);
  });

  it('responds to changed tastes even when undated history has more keeps than deletes', () => {
    const decisions: FeedDecision[] = Array.from({ length: 110 }, (_, index) => ({
      itemId: index + 1, feedId: 1, kept: index < 60,
    }));

    expect(getEffectiveFeedPriorities({}, decisions)[1]).toBeLessThan(0);
  });

  it('does not decay a source through decisions for other sources', () => {
    const otherFeed = Array.from({ length: DECISION_HALF_LIFE_REVIEWS }, (_, index) => ({
      itemId: index + 2, feedId: 2, kept: false,
    }));
    expect(getEffectiveFeedPriorities({}, [
      { itemId: 1, feedId: 1, kept: true }, ...otherFeed,
    ])[1]).toBeCloseTo(0.1);
  });

  it('ranks sources by their smoothed keep rate rather than raw keep counts', () => {
    const items: FeedItem[] = [
      { id: 30, feedId: 1, link: '', title: 'Frequent source', text: '' },
      { id: 20, feedId: 2, link: '', title: 'Preferred source', text: '' },
      { id: 10, feedId: 3, link: '', title: 'Unknown source', text: '' },
    ];
    const decisions = Array.from({ length: 10 }, (_, index) => ({
      itemId: index + 1, feedId: 1, kept: index < 3,
    }));
    decisions.push({ itemId: 11, feedId: 2, kept: true });
    decisions.push({ itemId: 12, feedId: 2, kept: true });

    const priorities = getEffectiveFeedPriorities({}, decisions);
    expect(orderFeedItems(items, 'desc', priorities).map(({ feedId }) => feedId)).toEqual([2, 3, 1]);
    expect(getEffectiveFeedPriorities({ 1: 1 }, decisions)[1]).toBeGreaterThan(priorities[2]);
    expect(getEffectiveFeedPriorities({ 1: -1 }, [])).toEqual({ 1: -1 });
  });

  it('orders feeds and their items by feed id priority', () => {
    const items: FeedItem[] = [
      { id: 30, feedId: 2, link: '', title: 'Newest low', text: '' },
      { id: 20, feedId: 1, link: '', title: 'Normal', text: '' },
      { id: 10, feedId: 3, link: '', title: 'Oldest high', text: '' },
    ];
    const priorities = { 2: -1, 3: 1 };

    expect(orderFeedItems(items, 'desc', priorities).map(({ id }) => id)).toEqual([10, 20, 30]);
  });

  it('keeps the selected item order inside equal-priority groups', () => {
    const items: FeedItem[] = [
      { id: 1, feedId: 1, link: '', title: 'One', text: '' },
      { id: 3, feedId: 2, link: '', title: 'Three', text: '' },
      { id: 2, feedId: 1, link: '', title: 'Two', text: '' },
    ];

    expect(orderFeedItems(items, 'asc', {}).map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(orderFeedItems(items, 'desc', {}).map(({ id }) => id)).toEqual([3, 2, 1]);
  });

  it('changes and validates the persisted feed-id map', () => {
    expect(changeFeedPriority({}, 42, 1)).toEqual({ 42: 1 });
    expect(changeFeedPriority({ 42: 1 }, 42, -1)).toEqual({});
    expect(parseFeedPriorities({ 42: -2, nope: 3, 7: 100, 8: 0 })).toEqual({ 42: -2 });
  });

  it.each(['asc', 'desc'] as const)('interleaves uneven sources without losing %s order within a source', (order) => {
    const items = [item(8, 1), item(7, 1), item(6, 1), item(5, 2), item(4, 2), item(3, 3)];
    const priorities = { 1: 0.3, 2: 0.1, 3: -0.2 };
    const ordered = orderFeedItems(items, order, priorities, true);

    expect(ordered.map(({ feedId }) => feedId)).toEqual([1, 2, 3, 1, 2, 1]);
    expect(ordered.filter(({ feedId }) => feedId === 1).map(({ id }) => id))
      .toEqual(order === 'asc' ? [6, 7, 8] : [8, 7, 6]);
    expect(ordered.filter(({ feedId }) => feedId === 2).map(({ id }) => id))
      .toEqual(order === 'asc' ? [4, 5] : [5, 4]);
    expect(new Set(ordered.map(({ id }) => id)).size).toBe(items.length);
    expect(items.map(({ id }) => id)).toEqual([8, 7, 6, 5, 4, 3]);
  });

  it('keeps all higher manual tiers before lower tiers while interleaving within a tier', () => {
    const items = [item(8, 1), item(7, 1), item(6, 2), item(5, 3), item(4, 3), item(3, 4), item(2, 5)];
    const priorities = { 1: 0.6, 2: 1.4, 3: -0.4, 4: 0.4, 5: -0.6 };

    expect(orderFeedItems(items, 'desc', priorities, true).map(({ id }) => id))
      .toEqual([6, 8, 7, 3, 5, 4, 2]);
  });

  it('uses chronological ties and handles empty or single-source lists', () => {
    expect(orderFeedItems([], 'desc', {}, true)).toEqual([]);
    expect(orderFeedItems([item(1, 1), item(3, 1), item(2, 1)], 'desc', {}, true)
      .map(({ id }) => id)).toEqual([3, 2, 1]);
    const items = [item(4, 1), item(3, 1), item(2, 2), item(1, 2)];
    expect(orderFeedItems(items, 'desc', {}, true).map(({ id }) => id)).toEqual([4, 2, 3, 1]);
    expect(orderFeedItems(items, 'desc', {}, false).map(({ id }) => id)).toEqual([4, 3, 2, 1]);
  });
});

function item(id: number, feedId: number): FeedItem {
  return { id, feedId, link: '', title: `${id}`, text: '' };
}

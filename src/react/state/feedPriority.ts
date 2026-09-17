import type { FeedItem } from '../types';
import type { FeedDecision } from './feedDecisions';

export type FeedPriorities = Readonly<Record<number, number>>;

export const FEED_PRIORITIES_STORAGE_KEY = 'gkfeed.feedPriorities.v1';
export function getEffectiveFeedPriorities(
  priorities: FeedPriorities,
  decisions: readonly FeedDecision[],
): FeedPriorities {
  const totals = new Map<number, { kept: number; reviewed: number }>();
  for (const decision of decisions) {
    const total = totals.get(decision.feedId) ?? { kept: 0, reviewed: 0 };
    total.kept += Number(decision.kept);
    total.reviewed += 1;
    totals.set(decision.feedId, total);
  }
  const result = { ...priorities };
  for (const [feedId, total] of totals) {
    result[feedId] = getFeedPriority(priorities, feedId)
      + (total.kept + 2) / (total.reviewed + 4) - 0.5;
  }
  return result;
}

export const MIN_FEED_PRIORITY = -99;
export const MAX_FEED_PRIORITY = 99;

export function getFeedPriority(priorities: FeedPriorities, feedId: number): number {
  return priorities[feedId] ?? 0;
}

export function changeFeedPriority(
  priorities: FeedPriorities,
  feedId: number,
  delta: -1 | 1,
): FeedPriorities {
  const nextPriority = Math.max(
    MIN_FEED_PRIORITY,
    Math.min(MAX_FEED_PRIORITY, getFeedPriority(priorities, feedId) + delta),
  );
  const nextPriorities = { ...priorities };

  if (nextPriority === 0) delete nextPriorities[feedId];
  else nextPriorities[feedId] = nextPriority;

  return nextPriorities;
}

export function orderFeedItems(
  items: readonly FeedItem[],
  itemOrder: 'asc' | 'desc',
  priorities: FeedPriorities,
): FeedItem[] {
  return [...items].sort((left, right) => {
    const priorityDifference = getFeedPriority(priorities, right.feedId)
      - getFeedPriority(priorities, left.feedId);
    if (priorityDifference !== 0) return priorityDifference;
    if (left.id === right.id) return 0;
    return itemOrder === 'asc'
      ? (left.id < right.id ? -1 : 1)
      : (left.id > right.id ? -1 : 1);
  });
}

export function parseFeedPriorities(value: unknown): FeedPriorities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const priorities: Record<number, number> = {};
  for (const [rawFeedId, priority] of Object.entries(value)) {
    const feedId = Number(rawFeedId);
    if (
      Number.isSafeInteger(feedId)
      && feedId > 0
      && typeof priority === 'number'
      && Number.isSafeInteger(priority)
      && priority >= MIN_FEED_PRIORITY
      && priority <= MAX_FEED_PRIORITY
      && priority !== 0
    ) priorities[feedId] = priority;
  }
  return priorities;
}

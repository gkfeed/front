import type { FeedItem } from '../types';
import type { FeedDecision } from './feedDecisions';

export type FeedPriorities = Readonly<Record<number, number>>;

export const FEED_PRIORITIES_STORAGE_KEY = 'gkfeed.feedPriorities.v1';

const PRIOR_KEEP_RATE = 0.5;
const PRIOR_REVIEW_COUNT = 4;
export const DECISION_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
export const DECISION_HALF_LIFE_REVIEWS = 50;

export function getEffectiveFeedPriorities(
  priorities: FeedPriorities,
  decisions: readonly FeedDecision[],
  now = Date.now(),
): FeedPriorities {
  const totals = new Map<number, { kept: number; reviewed: number }>();
  const newerReviews = new Map<number, number>();
  for (let index = decisions.length - 1; index >= 0; index -= 1) {
    const decision = decisions[index];
    const newerCount = newerReviews.get(decision.feedId) ?? 0;
    // Undated legacy history still fades as new decisions arrive for this feed.
    const age = decision.decidedAt === undefined ? 0 : Math.max(0, now - decision.decidedAt);
    const weight = 2 ** (-age / DECISION_HALF_LIFE_MS - newerCount / DECISION_HALF_LIFE_REVIEWS);
    const total = totals.get(decision.feedId) ?? { kept: 0, reviewed: 0 };
    total.kept += Number(decision.kept) * weight;
    total.reviewed += weight;
    totals.set(decision.feedId, total);
    newerReviews.set(decision.feedId, newerCount + 1);
  }
  const result = { ...priorities };
  for (const [feedId, total] of totals) {
    const smoothedKeepRate = (total.kept + PRIOR_KEEP_RATE * PRIOR_REVIEW_COUNT)
      / (total.reviewed + PRIOR_REVIEW_COUNT);
    result[feedId] = getFeedPriority(priorities, feedId) + smoothedKeepRate - PRIOR_KEEP_RATE;
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
  interleaveFeeds = false,
): FeedItem[] {
  const ordered = [...items].sort((left, right) => {
    const leftPriority = getFeedPriority(priorities, left.feedId);
    const rightPriority = getFeedPriority(priorities, right.feedId);
    const manualDifference = Math.round(rightPriority) - Math.round(leftPriority);
    if (manualDifference !== 0) return manualDifference;
    // Treat tiny automatic score differences as ties so timing alone cannot reshuffle cards.
    const priorityDifference = Math.round(rightPriority * 1000) - Math.round(leftPriority * 1000);
    if (priorityDifference !== 0) return priorityDifference;
    if (left.id === right.id) return 0;
    return itemOrder === 'asc'
      ? (left.id < right.id ? -1 : 1)
      : (left.id > right.id ? -1 : 1);
  });
  if (!interleaveFeeds) return ordered;

  // The automatic adjustment is strictly between -0.5 and 0.5, so rounding
  // recovers the manual tier. Never interleave across those tiers.
  const tiers = new Map<number, Map<number, FeedItem[]>>();
  for (const item of ordered) {
    const tier = Math.round(getFeedPriority(priorities, item.feedId));
    const feeds = tiers.get(tier) ?? new Map<number, FeedItem[]>();
    const queue = feeds.get(item.feedId) ?? [];
    queue.push(item);
    feeds.set(item.feedId, queue);
    tiers.set(tier, feeds);
  }

  const result: FeedItem[] = [];
  for (const feeds of tiers.values()) {
    let queues = [...feeds.values()];
    let round = 0;
    while (queues.length > 0) {
      const remaining: FeedItem[][] = [];
      for (const queue of queues) {
        result.push(queue[round]);
        if (queue.length > round + 1) remaining.push(queue);
      }
      queues = remaining;
      round += 1;
    }
  }
  return result;
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

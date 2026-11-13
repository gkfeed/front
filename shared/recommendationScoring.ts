import type { RecommendationCategory, RecommendationEvent } from './recommendationEvents.js';

export const VIEWED_THRESHOLD_MS = 10_000;
export const CLASSIFICATION_VERSION = 1;
export const RECOMMENDATION_CATEGORIES: readonly RecommendationCategory[] = [
  'keep_for_later', 'delete_immediately', 'delete_after_viewing',
];

export function classifyRecommendationEvent(event: Pick<RecommendationEvent, 'action' | 'activeMs'>): RecommendationCategory {
  if (event.action === 'keep') return 'keep_for_later';
  return event.activeMs >= VIEWED_THRESHOLD_MS ? 'delete_after_viewing' : 'delete_immediately';
}

export type ClassifiedRecommendationItem = RecommendationEvent & {
  category: RecommendationCategory;
  classificationVersion: typeof CLASSIFICATION_VERSION;
};

export type FeedRecommendationScore = {
  subjectId: string;
  feedId: number;
  itemCount: number;
  counts: Record<RecommendationCategory, number>;
  probabilities: Record<RecommendationCategory, number>;
  /** Null means there is a tie, so no single category represents this feed. */
  category: RecommendationCategory | null;
};

export function classifyRecommendationItems(events: Iterable<RecommendationEvent>): ClassifiedRecommendationItem[] {
  const items = new Map<string, ClassifiedRecommendationItem>();
  for (const event of events) {
    const key = JSON.stringify([event.subjectId, event.item.id]);
    // Items are unique. Re-delivery must not count or reclassify an item twice.
    if (!items.has(key)) items.set(key, { ...event, category: classifyRecommendationEvent(event),
      classificationVersion: CLASSIFICATION_VERSION });
  }
  return [...items.values()];
}

export function scoreRecommendationFeeds(events: Iterable<RecommendationEvent>): FeedRecommendationScore[] {
  const feeds = new Map<string, FeedRecommendationScore>();
  for (const event of classifyRecommendationItems(events)) {
    const key = JSON.stringify([event.subjectId, event.item.feedId]);
    let feed = feeds.get(key);
    if (!feed) {
      feed = { subjectId: event.subjectId, feedId: event.item.feedId, itemCount: 0, category: null,
        counts: { keep_for_later: 0, delete_immediately: 0, delete_after_viewing: 0 },
        probabilities: { keep_for_later: 0, delete_immediately: 0, delete_after_viewing: 0 } };
      feeds.set(key, feed);
    }
    feed.itemCount++;
    feed.counts[event.category]++;
  }
  for (const feed of feeds.values()) {
    for (const category of RECOMMENDATION_CATEGORIES) {
      feed.probabilities[category] = feed.counts[category] / feed.itemCount;
    }
    const maximum = Math.max(...Object.values(feed.counts));
    const leaders = RECOMMENDATION_CATEGORIES.filter((category) => feed.counts[category] === maximum);
    feed.category = leaders.length === 1 ? leaders[0] : null;
  }
  return [...feeds.values()].sort((a, b) => a.subjectId.localeCompare(b.subjectId) || a.feedId - b.feedId);
}

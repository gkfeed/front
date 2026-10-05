export type FeedDecision = {
  itemId: number;
  feedId: number;
  kept: boolean;
  decidedAt?: number;
};

export const MAX_FEED_DECISIONS = 5000;

export function recordFeedDecision(
  decisions: readonly FeedDecision[],
  decision: FeedDecision,
): readonly FeedDecision[] {
  const previous = decisions.find(({ itemId }) => itemId === decision.itemId);
  if (previous?.feedId === decision.feedId && previous.kept === decision.kept) return decisions;
  return [...decisions.filter(({ itemId }) => itemId !== decision.itemId), decision]
    .slice(-MAX_FEED_DECISIONS);
}

export function parseFeedDecisions(value: unknown): readonly FeedDecision[] {
  if (!Array.isArray(value)) return [];
  const decisions = new Map<number, FeedDecision>();
  for (const entry of value.slice(-MAX_FEED_DECISIONS)) {
    if (!entry || typeof entry !== 'object') continue;
    const { itemId, feedId, kept, decidedAt } = entry;
    if (
      !Number.isSafeInteger(itemId) || itemId <= 0
      || !Number.isSafeInteger(feedId) || feedId <= 0
      || typeof kept !== 'boolean'
    ) continue;
    decisions.delete(itemId);
    const decision: FeedDecision = { itemId, feedId, kept };
    if (Number.isSafeInteger(decidedAt) && decidedAt > 0) decision.decidedAt = decidedAt;
    decisions.set(itemId, decision);
  }
  return [...decisions.values()];
}

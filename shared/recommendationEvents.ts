export type RecommendationCategory = 'keep_for_later' | 'delete_immediately' | 'delete_after_viewing';

export type RecommendationEvent = {
  schemaVersion: 1;
  eventId: string;
  subjectId: string;
  occurredAt: string;
  action: 'keep' | 'delete';
  activeMs: number;
  item: { id: number; feedId: number; link: string; title: string; text: string };
};

export function isRecommendationEvent(value: unknown): value is RecommendationEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  const shortString = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const natural = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 0;
  const item = event.item as Record<string, unknown> | undefined;
  return event.schemaVersion === 1
    && ['eventId', 'subjectId'].every((key) => shortString(event[key], 100))
    && typeof event.occurredAt === 'string' && event.occurredAt.length <= 40 && Number.isFinite(Date.parse(event.occurredAt))
    && (event.action === 'keep' || event.action === 'delete')
    && natural(event.activeMs)
    && !!item && typeof item === 'object' && natural(item.id) && natural(item.feedId)
    && shortString(item.link, 4096)
    && typeof item.title === 'string' && item.title.length <= 2048
    && typeof item.text === 'string' && item.text.length <= 16384;
}

// Pick fields explicitly so request bodies cannot add credentials or arbitrary metadata.
export function pickRecommendationEvent(event: RecommendationEvent): RecommendationEvent {
  const { schemaVersion, eventId, subjectId, occurredAt, action, activeMs } = event;
  const { id, feedId, link, title, text } = event.item;
  return { schemaVersion, eventId, subjectId, occurredAt, action, activeMs,
    item: { id, feedId, link, title, text } };
}

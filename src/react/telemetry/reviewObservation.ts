import type { RecommendationEvent } from '../../../shared/recommendationEvents';
import type { FeedItem } from '../types';

type ObservationOptions = {
  item: FeedItem;
  subjectId: string;
  emit: (event: RecommendationEvent) => void;
  now?: () => number;
};

/** Measure visible card time and record one decision for the unique item. */
export function createReviewObservation({ item, subjectId, emit, now = () => performance.now() }: ObservationOptions) {
  let activeSince: number | null = null;
  let activeMs = 0;
  let shown = false;
  let decided = false;

  return {
    setVisible(visible: boolean) {
      if (visible && activeSince === null) {
        activeSince = now();
        shown = true;
      } else if (!visible && activeSince !== null) {
        activeMs += Math.max(0, now() - activeSince);
        activeSince = null;
      }
    },
    decide(action: 'keep' | 'delete'): RecommendationEvent | null {
      if (!shown || decided) return null;
      decided = true;
      const event: RecommendationEvent = {
        schemaVersion: 1, eventId: `${subjectId}:${item.id}`, subjectId,
        occurredAt: new Date().toISOString(), action,
        activeMs: Math.floor(activeMs + (activeSince === null ? 0 : Math.max(0, now() - activeSince))),
        item: { id: item.id, feedId: item.feedId, link: item.link.slice(0, 4096),
          title: item.title.slice(0, 2048), text: item.text.slice(0, 16384) },
      };
      emit(event);
      return event;
    },
  };
}

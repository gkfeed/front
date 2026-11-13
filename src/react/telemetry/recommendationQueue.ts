import { RECOMMENDATION_SCORES_UPDATED_EVENT, isRecommendationEvent, type RecommendationEvent } from '../../../shared/recommendationEvents';

const PREFIX = 'gkfeed.recommendation-outbox.v1:';
const memory = new Map<string, RecommendationEvent>();
const delivered = new Set<string>();
let flushing = false;
let started = false;

function readQueue(): RecommendationEvent[] {
  const events = new Map(memory);
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const event: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (isRecommendationEvent(event)) events.set(event.eventId, event);
    }
  } catch { /* In-memory events can still be sent when storage is unavailable. */ }
  return [...events.values()].filter((event) => !delivered.has(event.eventId));
}

export function enqueueRecommendationEvent(event: RecommendationEvent) {
  // One key per event avoids overwriting another tab's unsent events.
  memory.set(event.eventId, event);
  try { localStorage.setItem(PREFIX + event.eventId, JSON.stringify(event)); }
  catch { console.warn('Recommendation event could not be persisted in browser storage.'); }
  startRecommendationDelivery();
  void flushRecommendationEvents();
}

export function startRecommendationDelivery() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => { void flushRecommendationEvents(); });
  window.setInterval(() => { void flushRecommendationEvents(); }, 15_000);
  void flushRecommendationEvents();
}

export async function flushRecommendationEvents(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (true) {
      const batch = readQueue().slice(0, 5);
      if (!batch.length) break;
      const response = await fetch('/bff/recommendation-events', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
      });
      if (!response.ok) break;
      for (const event of batch) {
        delivered.add(event.eventId);
        memory.delete(event.eventId);
        try { localStorage.removeItem(PREFIX + event.eventId); }
        catch { /* A later retry may resend it; scoring counts unique items. */ }
      }
      window.dispatchEvent(new Event(RECOMMENDATION_SCORES_UPDATED_EVENT));
    }
  } catch { /* Keep the outbox for retry after a network failure or reload. */ }
  finally { flushing = false; }
}

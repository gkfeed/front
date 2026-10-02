import type { FeedItem } from '../../types';
import type { LiveCandidate, LiveEvent, LiveProviderRuntime } from '../../domain/liveEvents';

export function catalogCandidates(
  items: readonly FeedItem[],
  registry: readonly LiveProviderRuntime[],
  startOrder = 0,
): LiveCandidate[] {
  const candidates: LiveCandidate[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    for (const adapter of registry) {
      const candidate = adapter.recognize(item, startOrder + index);
      if (!candidate || seen.has(candidate.deduplicationKey)) continue;
      seen.add(candidate.deduplicationKey);
      candidates.push(candidate);
      break;
    }
  });
  return candidates;
}

export function mergeCandidates(
  existing: readonly LiveCandidate[],
  incoming: readonly LiveCandidate[],
): LiveCandidate[] {
  const byKey = new Map(existing.map((candidate) => [candidate.deduplicationKey, candidate]));
  for (const candidate of incoming) {
    if (!byKey.has(candidate.deduplicationKey)) byKey.set(candidate.deduplicationKey, candidate);
  }
  return [...byKey.values()].sort((a, b) => a.feedOrder - b.feedOrder);
}

export function retainCandidatesFromFeeds(
  candidates: readonly LiveCandidate[],
  activeFeedIds: ReadonlySet<number>,
): LiveCandidate[] {
  return candidates.filter((candidate) => activeFeedIds.has(candidate.item.feedId));
}

export function deduplicateLiveEvents(events: readonly LiveEvent[]): LiveEvent[] {
  const seenBroadcasts = new Set<string>();

  return events.filter((event) => {
    if (event.data.kind !== 'twitch') return true;
    const broadcast = normalizeTwitchBroadcastTitle(event.data.title);
    if (!broadcast) return true;
    if (seenBroadcasts.has(broadcast)) return false;
    seenBroadcasts.add(broadcast);
    return true;
  });
}

function normalizeTwitchBroadcastTitle(title: string): string {
  return title
    .replace(/\s+[@!][\p{L}\p{N}_-]+(?:[\s|,;:\p{Extended_Pictographic}\uFE0F]*[@!][\p{L}\p{N}_-]+)*\s*$/gu, '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

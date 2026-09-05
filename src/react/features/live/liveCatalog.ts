import type { FeedItem } from '../../types';
import type { LiveCandidate, LiveProviderRuntime } from '../../domain/liveEvents';

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

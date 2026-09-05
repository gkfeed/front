import type { HltvMatchSnapshot } from '../../../shared/previewContracts';
import type { FeedItem } from '../types';

export type LiveCandidate = {
  key: string;
  providerId: string;
  eventId: string;
  deduplicationKey: string;
  sharedEventId?: string;
  feedOrder: number;
  item: FeedItem;
};

export type LiveEventData =
  | { kind: 'twitch'; channel: string; title: string }
  | { kind: 'hltv'; snapshot: HltvMatchSnapshot };

export type LiveEvent = {
  candidate: LiveCandidate;
  data: LiveEventData;
  checkedAt: number;
  ended?: boolean;
};

export type LiveCategory = {
  id: string;
  titleKey: string;
  order: number;
  layout: 'grid' | 'list';
};

export type LiveCheckUpdate = {
  key: string;
  status: 'live' | 'offline';
  data?: LiveEventData;
};

export type LiveCheckBatch = {
  updates: LiveCheckUpdate[];
  failures: number;
};

export type LiveProviderRuntime = {
  id: string;
  category: LiveCategory;
  strategy: 'round-robin' | 'live-index';
  refreshIntervalMs: number;
  dormantSweepCycles: number;
  preserveEndedPlayback: boolean;
  recognize: (item: FeedItem, feedOrder: number) => LiveCandidate | null;
  check: (candidates: readonly LiveCandidate[], signal: AbortSignal) => Promise<LiveCheckBatch>;
};

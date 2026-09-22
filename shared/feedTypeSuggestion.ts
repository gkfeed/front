import { isFeedType, type FeedType } from './feedTypes.js';

export type FeedTypeSuggestion = {
  type: FeedType;
  confidence: number;
};

export function isFeedTypeSuggestion(value: unknown): value is FeedTypeSuggestion {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return isFeedType(candidate.type)
    && typeof candidate.confidence === 'number'
    && candidate.confidence >= 0
    && candidate.confidence <= 1;
}

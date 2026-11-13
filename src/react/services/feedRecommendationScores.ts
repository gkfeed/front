import type { FeedRecommendationScore } from '../../../shared/recommendationScoring';
import { RECOMMENDATION_CATEGORIES } from '../../../shared/recommendationScoring';
import { isRecord } from '../../../shared/valueGuards';
import { requestJson } from './httpRequest';

export type FeedScoresResponse = {
  classificationVersion: number;
  viewedThresholdMs: number;
  feeds: FeedRecommendationScore[];
};

export function isFeedScoresResponse(value: unknown): value is FeedScoresResponse {
  if (!isRecord(value) || value.classificationVersion !== 1 || value.viewedThresholdMs !== 10_000 || !Array.isArray(value.feeds)) return false;
  const seen = new Set<number>();
  return value.feeds.every((score: unknown) => {
    if (!isRecord(score) || typeof score.subjectId !== 'string' || !Number.isSafeInteger(score.feedId)
      || (score.feedId as number) <= 0 || !Number.isSafeInteger(score.itemCount) || (score.itemCount as number) <= 0
      || !isRecord(score.counts) || !isRecord(score.probabilities)
      || (score.category !== null && !RECOMMENDATION_CATEGORIES.some((category) => category === score.category))) return false;
    let total = 0;
    for (const category of RECOMMENDATION_CATEGORIES) {
      const count = score.counts[category];
      const probability = score.probabilities[category];
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0
        || typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1
        || Math.abs(probability - count / (score.itemCount as number)) > 0.000001) return false;
      total += count;
    }
    if (seen.has(score.feedId as number)) return false;
    seen.add(score.feedId as number);
    return total === score.itemCount;
  });
}

export async function getFeedRecommendationScores(subjectId: string, signal: AbortSignal): Promise<FeedScoresResponse> {
  const data = await requestJson<FeedScoresResponse>(`/bff/recommendation-feed-scores?${new URLSearchParams({ subjectId })}`, { signal }, {
    timeoutMs: 10_000,
    createHttpError: (status) => new Error(`Feed scores request failed: ${status}`),
    createTimeoutError: () => new Error('Feed scores request timed out'),
    validate: isFeedScoresResponse,
  });
  if (data.feeds.some((score) => score.subjectId !== subjectId)) throw new Error('Unexpected feed scores subject');
  return data;
}

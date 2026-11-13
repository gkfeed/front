import { afterEach, expect, it, vi } from 'vitest';

import { getFeedRecommendationScores, isFeedScoresResponse } from './feedRecommendationScores';

const score = { subjectId: 'reader', feedId: 1, itemCount: 10, category: 'keep_for_later',
  counts: { keep_for_later: 6, delete_immediately: 3, delete_after_viewing: 1 },
  probabilities: { keep_for_later: .6, delete_immediately: .3, delete_after_viewing: .1 } };
const data = { classificationVersion: 1, viewedThresholdMs: 10000, feeds: [score] };
afterEach(() => vi.unstubAllGlobals());

it('rejects inconsistent distributions and duplicate feeds before rendering charts', () => {
  expect(isFeedScoresResponse(data)).toBe(true);
  expect(isFeedScoresResponse({ ...data, feeds: [score, score] })).toBe(false);
  expect(isFeedScoresResponse({ ...data, feeds: [{ ...score, itemCount: 9 }] })).toBe(false);
  expect(isFeedScoresResponse({ ...data, feeds: [{ ...score, probabilities: { ...score.probabilities, keep_for_later: .8 } }] })).toBe(false);
});

it('loads scores with the subject and abort signal, and rejects data for a different subject', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(data));
  vi.stubGlobal('fetch', fetchMock);
  const signal = new AbortController().signal;
  expect(await getFeedRecommendationScores('reader', signal)).toEqual(data);
  expect(fetchMock).toHaveBeenCalledWith('/bff/recommendation-feed-scores?subjectId=reader', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  await expect(getFeedRecommendationScores('someone-else', signal)).rejects.toThrow('Unexpected feed scores subject');
});

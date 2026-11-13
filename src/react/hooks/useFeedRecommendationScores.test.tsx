// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { RECOMMENDATION_SCORES_UPDATED_EVENT } from '../../../shared/recommendationEvents';
import { getFeedRecommendationScores } from '../services/feedRecommendationScores';
import { useFeedRecommendationScores } from './useFeedRecommendationScores';

vi.mock('../services/feedRecommendationScores');
vi.mock('../telemetry/recommendationSubject', () => ({ getRecommendationSubjectId: () => 'reader' }));
vi.mock('../state/useAuth', () => ({ useAuth: () => ({ credentials: { username: 'reader' } }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it('refreshes after acknowledged decisions and removes the listener on unmount', async () => {
  vi.mocked(getFeedRecommendationScores).mockResolvedValue({ classificationVersion: 1, viewedThresholdMs: 10000, feeds: [] });
  const { result, unmount } = renderHook(() => useFeedRecommendationScores());
  await waitFor(() => expect(result.current.status).toBe('success'));
  act(() => { window.dispatchEvent(new Event(RECOMMENDATION_SCORES_UPDATED_EVENT)); });
  await waitFor(() => expect(getFeedRecommendationScores).toHaveBeenCalledTimes(2));
  unmount();
  window.dispatchEvent(new Event(RECOMMENDATION_SCORES_UPDATED_EVENT));
  expect(getFeedRecommendationScores).toHaveBeenCalledTimes(2);
});

it('does not fetch scores in scroll mode', () => {
  const { result } = renderHook(() => useFeedRecommendationScores(false));
  window.dispatchEvent(new Event(RECOMMENDATION_SCORES_UPDATED_EVENT));
  expect(result.current.status).toBe('idle');
  expect(getFeedRecommendationScores).not.toHaveBeenCalled();
});

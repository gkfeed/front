import { useCallback, useEffect } from 'react';

import { RECOMMENDATION_SCORES_UPDATED_EVENT } from '../../../shared/recommendationEvents';
import { getFeedRecommendationScores } from '../services/feedRecommendationScores';
import { useAuth } from '../state/useAuth';
import { getRecommendationSubjectId } from '../telemetry/recommendationSubject';
import { useAsyncResource } from './useAsyncResource';

export function useFeedRecommendationScores(enabled = true) {
  const { credentials } = useAuth();
  const username = credentials?.username;
  const load = useCallback((signal: AbortSignal) => {
    if (!username) throw new Error('Missing score subject');
    return getFeedRecommendationScores(getRecommendationSubjectId(username), signal);
  }, [username]);
  const resource = useAsyncResource(load, { enabled: enabled && !!username, key: username });
  const { retry } = resource;

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(RECOMMENDATION_SCORES_UPDATED_EVENT, retry);
    return () => window.removeEventListener(RECOMMENDATION_SCORES_UPDATED_EVENT, retry);
  }, [enabled, retry]);

  return resource;
}

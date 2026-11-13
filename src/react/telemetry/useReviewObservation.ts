import { useCallback, useEffect, useRef } from 'react';

import type { FeedItem } from '../types';
import { useAuth } from '../state/useAuth';
import { randomId } from './randomId';
import { enqueueRecommendationEvent, startRecommendationDelivery } from './recommendationQueue';
import { createReviewObservation } from './reviewObservation';

const subjects = new Map<string, string>();

function getSubjectId(username: string): string {
  let subjectId = subjects.get(username);
  if (!subjectId) {
    const key = `gkfeed.recommendation-subject.v1:${encodeURIComponent(username)}`;
    subjectId = randomId();
    try {
      subjectId = localStorage.getItem(key) || subjectId;
      localStorage.setItem(key, subjectId);
    } catch { /* Keep recording for this visit when storage is unavailable. */ }
    subjects.set(username, subjectId);
  }
  return subjectId;
}

export function useReviewObservation(item: FeedItem | undefined) {
  const { credentials } = useAuth();
  const username = credentials?.username;
  const observation = useRef<ReturnType<typeof createReviewObservation> | null>(null);
  const latestItem = useRef(item);
  useEffect(() => { latestItem.current = item; }, [item]);

  useEffect(() => {
    if (!username || !latestItem.current) return;
    startRecommendationDelivery();
    const current = createReviewObservation({ item: latestItem.current, subjectId: getSubjectId(username),
      emit: enqueueRecommendationEvent });
    observation.current = current;
    const visibility = () => current.setVisible(document.visibilityState === 'visible');
    const pageHide = () => current.setVisible(false);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', visibility);
    return () => {
      observation.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', visibility);
    };
  }, [item?.id, username]);

  return useCallback((action: 'keep' | 'delete') => observation.current?.decide(action) ?? null, []);
}

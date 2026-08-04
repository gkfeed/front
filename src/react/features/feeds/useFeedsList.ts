import { useCallback } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { getRequestErrorMessage } from '../../services/authError';
import { getAllFeeds } from '../../services/feeds';
import { useAuth } from '../../state/useAuth';

type Translator = (key: string) => string;

export function useFeedsList(t: Translator) {
  const { credentials } = useAuth();
  const load = useCallback((signal: AbortSignal) => getAllFeeds(credentials, signal), [credentials]);
  const { result: feeds = [], error, isLoading, retry } = useAsyncLoad(load);

  return {
    feeds,
    errorMessage: error ? getRequestErrorMessage(error, t, 'feed.unableConnection') : '',
    isLoading,
    retry,
  };
}

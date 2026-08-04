import { useCallback } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { loadFeeds } from './feedUseCases';
import { useAuth } from '../../state/useAuth';
import { getRequestErrorMessage } from '../requestError';

type Translator = (key: string) => string;

export function useFeedsList(t: Translator) {
  const { credentials } = useAuth();
  const load = useCallback((signal: AbortSignal) => loadFeeds(credentials, signal), [credentials]);
  const { result: feeds = [], error, isLoading, retry } = useAsyncLoad(load);

  return {
    feeds,
    errorMessage: error ? getRequestErrorMessage(error, t, 'feed.unableConnection') : '',
    isLoading,
    retry,
  };
}

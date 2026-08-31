import { useCallback } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { useAuth } from '../../state/useAuth';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';
import { getRequestErrorMessage } from '../../presentation/requestErrorMessage';

type Translator = (key: string) => string;

export function useFeedsList(t: Translator) {
  const { credentials } = useAuth();
  const { feeds } = useFeatureUseCases();
  const load = useCallback(
    (signal: AbortSignal) => feeds.loadFeeds(credentials, signal),
    [credentials, feeds],
  );
  const { result: loadedFeeds = [], error, isLoading, retry } = useAsyncLoad(load);

  return {
    feeds: loadedFeeds,
    errorMessage: error ? getRequestErrorMessage(error, t, 'feed.unableConnection') : '',
    isLoading,
    retry,
  };
}

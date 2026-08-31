import { useCallback } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { useAuth } from '../../state/useAuth';
import { useFeatureUseCases } from '../../state/useFeatureUseCases';
import { getRequestErrorMessage } from '../../presentation/requestErrorMessage';

type Translator = (key: string) => string;

export function useLiveTwitchStreams(t: Translator) {
  const { credentials } = useAuth();
  const { live } = useFeatureUseCases();
  const load = useCallback(
    (signal: AbortSignal) => live.loadLiveTwitchItems(credentials, signal),
    [credentials, live],
  );
  const resource = useAsyncLoad(load);

  return {
    ...resource,
    errorMessage: resource.error
      ? getRequestErrorMessage(resource.error, t, 'live.checkErrorText')
      : '',
  };
}

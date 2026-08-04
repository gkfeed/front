import { useCallback } from 'react';

import { featureUseCases } from '../../application/featureComposition';
import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { useAuth } from '../../state/useAuth';
import { getRequestErrorMessage } from '../requestError';

type Translator = (key: string) => string;

export function useLiveTwitchStreams(t: Translator) {
  const { credentials } = useAuth();
  const load = useCallback(
    (signal: AbortSignal) => featureUseCases.live.loadLiveTwitchItems(credentials, signal),
    [credentials],
  );
  const resource = useAsyncLoad(load);

  return {
    ...resource,
    errorMessage: resource.error
      ? getRequestErrorMessage(resource.error, t, 'live.checkErrorText')
      : '',
  };
}

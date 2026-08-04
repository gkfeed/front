import { useCallback } from 'react';

import { useAsyncLoad } from '../../hooks/useAsyncLoad';
import { getRequestErrorMessage } from '../../services/authError';
import { getLiveTwitchItems } from '../../services/twitch';
import { useAuth } from '../../state/useAuth';

type Translator = (key: string) => string;

export function useLiveTwitchStreams(t: Translator) {
  const { credentials } = useAuth();
  const load = useCallback((signal: AbortSignal) => getLiveTwitchItems(credentials, signal), [credentials]);
  const resource = useAsyncLoad(load);

  return {
    ...resource,
    errorMessage: resource.error
      ? getRequestErrorMessage(resource.error, t, 'live.checkErrorText')
      : '',
  };
}

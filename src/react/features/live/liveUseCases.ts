import type { Credentials, FeedItem } from '../../types';
import type { LiveApplicationPort } from '../featurePorts';

export function createLiveUseCases(port: LiveApplicationPort) {
  function loadLiveTwitchItems(
    credentials: Credentials | null,
    signal?: AbortSignal,
  ): Promise<FeedItem[]> {
    return port.getLiveTwitchItems(credentials, signal);
  }

  return { loadLiveTwitchItems };
}

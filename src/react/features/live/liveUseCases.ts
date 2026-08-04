import type { Credentials, FeedItem } from '../../types';
import { getLiveTwitchItems } from '../../services/twitch';

export function loadLiveTwitchItems(
  credentials: Credentials | null,
  signal?: AbortSignal,
): Promise<FeedItem[]> {
  return getLiveTwitchItems(credentials, signal);
}

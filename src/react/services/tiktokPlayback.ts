import { requestBffJson } from './bffClient';
import { isTikTokPlaybackPreview } from '../../../shared/tiktokContracts';

export function fetchTikTokPlayback(url: string, signal: AbortSignal) {
  return requestBffJson({
    endpoint: '/bff/tiktok-playback',
    input: url,
    resourceName: 'TikTok playback',
    validate: isTikTokPlaybackPreview,
    signal,
  });
}

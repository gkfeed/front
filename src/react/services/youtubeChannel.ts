import {
  isYoutubeChannelResolution,
  parseYoutubeChannelUrl,
  type YoutubeChannelResolution,
} from '../../../shared/youtubeChannel';
import { BffResponseError, requestBffJson } from './bffClient';

const ENDPOINT = '/bff/youtube-channel';

export async function resolveYoutubeChannel(url: string, signal?: AbortSignal): Promise<YoutubeChannelResolution> {
  const result = await requestBffJson({
    endpoint: ENDPOINT,
    input: url,
    resourceName: 'YouTube channel',
    validate: isYoutubeChannelResolution,
    signal,
  });
  const requested = parseYoutubeChannelUrl(url);
  const resolved = parseYoutubeChannelUrl(result.url);
  if (!requested || requested.tab !== resolved?.tab
    || (requested.channelId !== null && requested.channelId !== result.channelId)) {
    throw new BffResponseError('YouTube channel response does not match the request', ENDPOINT);
  }
  return result;
}

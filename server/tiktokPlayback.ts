import { normalizeExternalText } from '../shared/text.js';
import { isTikTokAvatarUrl, isTikTokMediaUrl, type TikTokPlaybackPreview } from '../shared/tiktokContracts.js';
import { isRecord } from '../shared/valueGuards.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { fetchTikTokJson } from './tiktokJson.js';
import { parseTikTokVideoUrl } from './tiktokUrlParser.js';

export async function fetchTikTokPlayback(
  input: string,
  context?: RequestExecutionContext,
): Promise<TikTokPlaybackPreview> {
  const post = parseTikTokVideoUrl(input);
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', post.href);
  const response = await fetchTikTokJson(upstream, 'details', context);
  const value = response?.value;
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)
    || !isTikTokMediaUrl(value.data.play)) {
    throw new PreviewError('TikTok video is unavailable', 'invalid_details');
  }
  const author = isRecord(value.data.author) ? value.data.author : null;
  return {
    videoUrl: value.data.play,
    ...(author ? { author: {
      name: typeof author.nickname === 'string' ? normalizeExternalText(author.nickname) || null : null,
      username: typeof author.unique_id === 'string' ? normalizeExternalText(author.unique_id) || null : null,
      avatarUrl: isTikTokAvatarUrl(author.avatar) ? author.avatar : null,
    } } : {}),
  };
}

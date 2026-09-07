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
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)) {
    throw new PreviewError('TikTok video is unavailable', 'invalid_details');
  }
  const imageUrls = Array.isArray(value.data.images)
    ? value.data.images.filter(isTikTokAvatarUrl) : [];
  const videoUrl = isTikTokMediaUrl(value.data.play) ? value.data.play : undefined;
  if (!imageUrls.length && !videoUrl) {
    throw new PreviewError('TikTok video is unavailable', 'invalid_details');
  }
  const media = imageUrls.length
    ? { imageUrls, ...(videoUrl ? { videoUrl } : {}) }
    : { videoUrl: videoUrl! };
  const author = isRecord(value.data.author) ? value.data.author : null;
  return {
    ...media,
    ...(author ? { author: {
      name: typeof author.nickname === 'string' ? normalizeExternalText(author.nickname) || null : null,
      username: typeof author.unique_id === 'string' ? normalizeExternalText(author.unique_id) || null : null,
      avatarUrl: isTikTokAvatarUrl(author.avatar) ? author.avatar : null,
    } } : {}),
  };
}

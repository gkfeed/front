import { normalizeExternalText } from '../shared/text.js';
import { isTikTokAvatarUrl, isTikTokMediaUrl, type TikTokPlaybackPreview } from '../shared/tiktokContracts.js';
import { isRecord } from '../shared/valueGuards.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { fetchTikTokJson, isRetryableTikTokRequestError, isTikTokRequestTimeout } from './tiktokJson.js';
import { fetchTikTokDirectPlayback } from './tiktokDirectPlayback.js';
import { parseTikTokVideoUrl } from './tiktokUrlParser.js';

export async function fetchTikTokPlayback(
  input: string,
  context?: RequestExecutionContext,
): Promise<TikTokPlaybackPreview> {
  const post = parseTikTokVideoUrl(input);
  try {
    const direct = await fetchTikTokDirectPlayback(post, context);
    if (direct) return direct;
  } catch {
    if (context?.signal.aborted) throw new PreviewError('TikTok playback request aborted', 'tiktok_upstream_unavailable');
  }
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', post.href);
  let response: Awaited<ReturnType<typeof fetchTikTokJson>>;
  try {
    response = await fetchTikTokJson(upstream, 'details', context);
  } catch (error) {
    if (isTikTokRequestTimeout(error)) {
      throw new PreviewError('TikTok playback provider timed out', 'tiktok_upstream_timeout');
    }
    if (isRetryableTikTokRequestError(error)) {
      throw new PreviewError('TikTok playback provider is unavailable', 'tiktok_upstream_unavailable');
    }
    throw error;
  }
  const value = response?.value;
  if (isRecord(value) && value.code === -1
    && typeof value.msg === 'string' && value.msg.startsWith('Free Api Limit:')) {
    throw new PreviewError('TikTok playback provider is rate limited', 'tiktok_rate_limited');
  }
  if (!response) throw new PreviewError('TikTok video is unavailable', 'tiktok_upstream_unavailable');
  if (isRecord(value) && typeof value.code === 'number' && value.code !== 0) {
    throw new PreviewError('TikTok video is unavailable', 'tiktok_upstream_rejected');
  }
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

import { getTikTokMediaCookie, isTikTokDirectMediaHost, TIKTOK_DIRECT_USER_AGENT } from '../tiktokDirectPlayback.js';
import { isTikTokMediaUrl } from '../../shared/tiktokContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import type { PreviewVideo } from '../application/previewContracts.js';
import { requestPublicHttp } from '../publicHttp.js';
import { PreviewError } from './errors.js';

export async function fetchTikTokMedia(input: string, range: string | undefined, context: RequestExecutionContext): Promise<PreviewVideo> {
  if (!isTikTokMediaUrl(input)) throw new PreviewError('Invalid TikTok media URL', 'invalid_url');
  if (range && !/^bytes=\d*-\d*$/.test(range)) throw new PreviewError('Invalid media byte range', 'invalid_range');
  const url = new URL(input);
  const cookie = isTikTokDirectMediaHost(url.hostname) ? getTikTokMediaCookie(input) : undefined;
  if (isTikTokDirectMediaHost(url.hostname) && !cookie) throw new PreviewError('TikTok media session expired', 'upstream_error');
  const media = await requestPublicHttp(url, { ...(range ? { range } : {}), ...(cookie ? { cookie, referer: 'https://www.tiktok.com/', 'user-agent': TIKTOK_DIRECT_USER_AGENT } : {}) }, context, { streamBody: true });
  const contentType = media.headers['content-type']?.toString().split(';')[0]?.trim().toLowerCase();
  if ((media.status !== 200 && media.status !== 206) || !contentType || !/^(video|audio)\//.test(contentType)) {
    media.body.destroy();
    throw new PreviewError('TikTok media stream unavailable', 'upstream_error');
  }
  return {
    body: media.body, status: media.status, contentType,
    acceptRanges: media.headers['accept-ranges']?.toString() ?? 'bytes',
    ...(media.headers['content-length'] ? { contentLength: media.headers['content-length'].toString() } : {}),
    ...(media.headers['content-range'] ? { contentRange: media.headers['content-range'].toString() } : {}),
  };
}

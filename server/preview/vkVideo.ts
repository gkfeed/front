import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import type { PreviewVideo, VkVideoSource } from '../application/previewContracts.js';
import { requestPublicHttp } from '../publicHttp.js';
import { isVkHost } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { fetchVkHtml } from './vkFetcher.js';
import { parsePublicHttpUrl, throwPublicUrlError } from './remoteHttp.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const VK_EMBED_PATH = /^\/(?:video|clip)_ext\.php$/i;
const VIDEO_QUALITY_PATTERN = /"url(\d+)":"((?:\\.|[^"\\])*)"/g;

export async function fetchVkVideoSource(
  input: string,
  context?: RequestExecutionContext,
): Promise<VkVideoSource> {
  const embedUrl = parsePublicHttpUrl(input);
  if (
    !isVkHost(embedUrl.hostname)
    || !VK_EMBED_PATH.test(embedUrl.pathname)
    || !/^-?\d+$/.test(embedUrl.searchParams.get('oid') ?? '')
    || !/^\d+$/.test(embedUrl.searchParams.get('id') ?? '')
  ) {
    throw new PreviewError('Only VK video embeds can be proxied', 'invalid_vk_video');
  }

  const { html } = await fetchVkHtml(embedUrl, context);
  const sources = [...html.matchAll(VIDEO_QUALITY_PATTERN)]
    .map((match) => ({ quality: Number(match[1]), url: decodeJsonString(match[2] ?? '') }))
    .filter((source): source is { quality: number; url: string } => Boolean(source.url))
    .sort((left, right) => right.quality - left.quality);
  const source = sources.find(({ quality }) => quality <= 720) ?? sources.at(-1);
  if (!source) throw new PreviewError('VK video stream is unavailable', 'vk_video_unavailable');

  return {
    url: parsePublicHttpUrl(source.url).href,
    referer: `${embedUrl.origin}/`,
  };
}

export async function fetchVkVideoStream(
  source: VkVideoSource,
  range: string | undefined,
  context: RequestExecutionContext,
): Promise<PreviewVideo> {
  if (range && !/^bytes=\d*-\d*(?:,\d*-\d*)*$/i.test(range)) {
    throw new PreviewError('Invalid video byte range', 'invalid_range');
  }
  const url = parsePublicHttpUrl(source.url);
  const headers: Record<string, string> = {
    accept: 'video/mp4,video/*;q=0.9,*/*;q=0.1',
    referer: source.referer,
    'user-agent': TWITTERBOT_USER_AGENT,
  };
  if (range) headers.range = range;

  const video = await requestPublicHttp(url, headers, context).catch((error: unknown) => {
    throwPublicUrlError(error);
    throw new PreviewError('The VK video stream could not be fetched', 'fetch_failed');
  });
  if (video.status !== 200 && video.status !== 206) {
    video.body.destroy();
    throw new PreviewError(`VK returned HTTP ${video.status} for the video stream`, 'upstream_error');
  }
  const contentType = video.headers['content-type']?.toString().split(';')[0]?.trim().toLowerCase();
  if (!contentType?.startsWith('video/')) {
    video.body.destroy();
    throw new PreviewError('VK did not return a video stream', 'invalid_video');
  }
  return {
    body: video.body,
    status: video.status,
    contentType,
    acceptRanges: video.headers['accept-ranges']?.toString() ?? 'bytes',
    ...(video.headers['content-length']
      ? { contentLength: video.headers['content-length'].toString() }
      : {}),
    ...(video.headers['content-range']
      ? { contentRange: video.headers['content-range'].toString() }
      : {}),
  };
}

function decodeJsonString(value: string): string | null {
  try {
    const decoded = JSON.parse(`"${value}"`);
    return typeof decoded === 'string' && decoded ? decoded : null;
  } catch {
    return null;
  }
}

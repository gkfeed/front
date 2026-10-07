import { Readable } from 'node:stream';
import { parseHTML } from 'linkedom';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import type { PreviewVideo, VkVideoSource } from '../application/previewContracts.js';
import { requestPublicHttp } from '../publicHttp.js';
import { isVkHost } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { fetchVkHtml } from './vkFetcher.js';
import { parsePublicHttpUrl, throwPublicUrlError } from './remoteHttp.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import { readBoundedText } from './boundedStreamReader.js';

const VK_EMBED_PATH = /^\/(?:video|clip)_ext\.php$/i;
const VIDEO_QUALITY_PATTERN = /"url(\d+)":"((?:\\.|[^"\\])*)"/g;
const VK_HLS_HOST = /^vkvd\d+\.okcdn\.ru$/i;
const VK_HLS_PATH = /^\/(?:video\.m3u8|expires\/[A-Za-z0-9._~/-]+\/video\/(?:[A-Za-z0-9._-]+\.(?:ts|m4s|mp4|aac|key))?)$/i;

export async function fetchVkVideoSource(
  input: string,
  context?: RequestExecutionContext,
): Promise<VkVideoSource> {
  const embedUrl = parsePublicHttpUrl(input);
  if (isVkHlsUrl(embedUrl)) return { url: embedUrl.href, referer: 'https://vkvideo.ru/' };
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
  if (!source) {
    // Some recordings have no embed stream, but expose HLS on the public video page.
    const videoUrl = new URL(`/video${embedUrl.searchParams.get('oid')}_${embedUrl.searchParams.get('id')}`, embedUrl);
    const page = await fetchVkHtml(videoUrl, context);
    const { document } = parseHTML(page.html);
    const hlsSource = document.querySelector('video source[type="application/vnd.apple.mpegurl"]')
      ?.getAttribute('src');
    if (hlsSource) {
      const url = parsePublicHttpUrl(new URL(hlsSource, page.url).href);
      if (isVkHlsUrl(url)) return { url: url.href, referer: `${page.url.origin}/` };
    }
    throw new PreviewError('VK video stream is unavailable', 'vk_video_unavailable');
  }

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
    accept: 'application/vnd.apple.mpegurl,application/x-mpegurl,video/*;q=0.9,*/*;q=0.1',
    referer: source.referer,
    'user-agent': TWITTERBOT_USER_AGENT,
  };
  if (range) headers.range = range;

  const video = await requestPublicHttp(url, headers, context, { streamBody: true }).catch((error: unknown) => {
    throwPublicUrlError(error);
    throw new PreviewError('The VK video stream could not be fetched', 'fetch_failed');
  });
  if (video.status !== 200 && video.status !== 206) {
    video.body.destroy();
    throw new PreviewError(`VK returned HTTP ${video.status} for the video stream`, 'upstream_error');
  }
  const contentType = video.headers['content-type']?.toString().split(';')[0]?.trim().toLowerCase();
  if (isVkHlsUrl(url) && ['application/vnd.apple.mpegurl', 'application/x-mpegurl', 'audio/mpegurl'].includes(contentType ?? '')) {
    const playlist = await readBoundedText(video.body, {
      maximumBytes: 1_000_000,
      tooLarge: () => new PreviewError('The VK playlist is too large', 'response_too_large'),
      onLimit: () => video.body.destroy(),
    });
    if (video.status !== 200 || !playlist.startsWith('#EXTM3U')) {
      throw new PreviewError('VK did not return an HLS playlist', 'invalid_video');
    }
    const rewritten = playlist.split('\n').map((line) => {
      const value = line.trim();
      if (!value) return line;
      if (!value.startsWith('#')) return proxyHlsResource(value, url);
      return value.startsWith('#EXT-X-')
        ? line.replace(/([:,])URI="([^"]*)"/g, (_match, separator: string, resource: string) => (
          `${separator}URI="${proxyHlsResource(resource, url)}"`
        ))
        : line;
    }).join('\n');
    return {
      body: Readable.from([rewritten]), status: 200,
      contentType: 'application/vnd.apple.mpegurl', acceptRanges: 'none',
      contentLength: String(Buffer.byteLength(rewritten)),
    };
  }
  if (!contentType || (!contentType.startsWith('video/')
    && !(isVkHlsUrl(url) && ['audio/aac', 'audio/mp4', 'application/octet-stream'].includes(contentType)))) {
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

function isVkHlsUrl(url: URL): boolean {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && VK_HLS_HOST.test(url.hostname) && VK_HLS_PATH.test(url.pathname);
}

function proxyHlsResource(resource: string, playlistUrl: URL): string {
  const url = parsePublicHttpUrl(new URL(resource, playlistUrl).href);
  if (!isVkHlsUrl(url)) throw new PreviewError('Invalid VK HLS resource URL', 'invalid_vk_video');
  return `/bff/vk-video?url=${encodeURIComponent(url.href)}`;
}

function decodeJsonString(value: string): string | null {
  try {
    const decoded = JSON.parse(`"${value}"`);
    return typeof decoded === 'string' && decoded ? decoded : null;
  } catch {
    return null;
  }
}

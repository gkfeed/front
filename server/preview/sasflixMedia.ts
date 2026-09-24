import { Readable } from 'node:stream';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import type { PreviewVideo } from '../application/previewContracts.js';
import { requestPublicHttp } from '../publicHttp.js';
import { readBoundedBytes, readBoundedText } from './boundedStreamReader.js';
import { PreviewError } from './errors.js';
import { parsePublicHttpUrl, throwPublicUrlError } from './remoteHttp.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const SASFLIX_VIDEO_PATH = /^\/api\/video\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.m3u8|\/(?:240|360|480|720|1080|1440|2160))$/i;
const SASFLIX_SEGMENT_PATH = /^\/sasflix\/[A-Za-z0-9._/-]+\.(?:ts|m3u8|m4s|mp4|key|aac)$/i;
const SASFLIX_SEGMENT_HOSTS = new Set([
  'media.sasflix.ru',
  'mirror.sasflix.ru',
  'reflector.sasflix.ru',
]);
const MAX_PLAYLIST_BYTES = 1_000_000;
const MAX_KEY_BYTES = 64_000;

export async function fetchSasflixMedia(
  input: string,
  range: string | undefined,
  context: RequestExecutionContext,
): Promise<PreviewVideo> {
  const url = validateSasflixMediaUrl(input);
  if (range && !/^bytes=\d*-\d*(?:,\d*-\d*)*$/i.test(range)) {
    throw new PreviewError('Invalid video byte range', 'invalid_range');
  }

  const headers: Record<string, string> = {
    accept: 'application/vnd.apple.mpegurl,audio/mpegurl,video/mp2t,video/*;q=0.9,audio/*;q=0.8,application/octet-stream;q=0.7,*/*;q=0.1',
    referer: 'https://sasflix.ru/',
    'user-agent': TWITTERBOT_USER_AGENT,
  };
  if (range) headers.range = range;

  const media = await requestPublicHttp(url, headers, context).catch((error: unknown) => {
    throwPublicUrlError(error);
    throw new PreviewError('The Sasflix stream could not be fetched', 'fetch_failed');
  });
  if (media.status !== 200 && media.status !== 206) {
    media.body.destroy();
    throw new PreviewError(`Sasflix returned HTTP ${media.status}`, 'upstream_error');
  }

  const contentType = media.headers['content-type']?.toString().split(';')[0]?.trim().toLowerCase();
  if (isPlaylistUrl(url)) {
    if (media.status !== 200 || !isPlaylistContentType(contentType)) {
      media.body.destroy();
      throw new PreviewError('Sasflix did not return an HLS playlist', 'invalid_video');
    }
    const playlist = await readBoundedText(media.body, {
      maximumBytes: MAX_PLAYLIST_BYTES,
      tooLarge: () => new PreviewError('The Sasflix playlist is too large', 'response_too_large'),
      onLimit: () => media.body.destroy(),
    });
    const rewritten = rewritePlaylist(playlist, url);
    return {
      body: Readable.from([rewritten]),
      status: 200,
      contentType: 'application/vnd.apple.mpegurl',
      acceptRanges: 'none',
      contentLength: String(Buffer.byteLength(rewritten)),
    };
  }

  if (url.pathname.toLowerCase().endsWith('.key')) {
    if (media.status !== 200 || !['application/octet-stream', 'binary/octet-stream'].includes(contentType ?? '')) {
      media.body.destroy();
      throw new PreviewError('Sasflix did not return an HLS key', 'invalid_video');
    }
    const body = await readBoundedBytes(media.body, MAX_KEY_BYTES, () => (
      new PreviewError('The Sasflix key is too large', 'response_too_large')
    ));
    return {
      body: Readable.from([body]),
      status: 200,
      contentType: 'application/octet-stream',
      acceptRanges: 'none',
      contentLength: String(body.byteLength),
    };
  }

  const validContentTypes = url.pathname.toLowerCase().endsWith('.ts')
    ? ['video/mp2t']
    : url.pathname.toLowerCase().endsWith('.aac')
      ? ['audio/aac', 'audio/aacp']
      : ['video/mp4', 'audio/mp4', 'video/iso.segment', 'application/octet-stream'];
  if (!contentType || !validContentTypes.includes(contentType)) {
    media.body.destroy();
    throw new PreviewError('Sasflix did not return an HLS media resource', 'invalid_video');
  }
  return {
    body: media.body,
    status: media.status,
    contentType,
    acceptRanges: media.headers['accept-ranges']?.toString() ?? 'bytes',
    ...(media.headers['content-length']
      ? { contentLength: media.headers['content-length'].toString() }
      : {}),
    ...(media.headers['content-range']
      ? { contentRange: media.headers['content-range'].toString() }
      : {}),
  };
}

function validateSasflixMediaUrl(input: string): URL {
  const url = parsePublicHttpUrl(input);
  const validHostAndPath = url.hostname === 'sasflix.ru'
    ? SASFLIX_VIDEO_PATH.test(url.pathname) && !url.search
    : SASFLIX_SEGMENT_HOSTS.has(url.hostname) && SASFLIX_SEGMENT_PATH.test(url.pathname);
  if (
    url.protocol !== 'https:'
    || url.username
    || url.password
    || url.port
    || !validHostAndPath
  ) {
    throw new PreviewError('Only Sasflix HLS media can be proxied', 'invalid_sasflix_media');
  }
  return url;
}

function isPlaylistUrl(url: URL): boolean {
  return url.hostname === 'sasflix.ru' || url.pathname.toLowerCase().endsWith('.m3u8');
}

function isPlaylistContentType(contentType: string | undefined): boolean {
  return contentType === 'audio/mpegurl'
    || contentType === 'application/vnd.apple.mpegurl'
    || contentType === 'application/x-mpegurl';
}

function rewritePlaylist(playlist: string, playlistUrl: URL): string {
  return playlist.split('\n').map((line) => {
    const value = line.trim();
    if (!value) return line;
    if (value.startsWith('#')) {
      if (!value.startsWith('#EXT-X-')) return line;
      return line.replace(/([:,])URI="([^"]*)"/g, (_attribute, separator: string, resource: string) => (
        `${separator}URI="${proxyMediaUrl(resource, playlistUrl)}"`
      ));
    }
    return proxyMediaUrl(value, playlistUrl);
  }).join('\n');
}

function proxyMediaUrl(resource: string, playlistUrl: URL): string {
  let mediaUrl: URL;
  try {
    mediaUrl = validateSasflixMediaUrl(new URL(resource, playlistUrl).href);
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('Invalid Sasflix HLS resource URL', 'invalid_sasflix_media');
  }
  return `/bff/sasflix-media?url=${encodeURIComponent(mediaUrl.href)}`;
}

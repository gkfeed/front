import type { OpenGraphPreview } from '../../../shared/previewContracts.js';
import { isYoutubeVideoUrl } from '../../../shared/urlRules.js';
import { getStringProperty, isRecord } from '../../../shared/valueGuards.js';
import { readLimitedJson } from '../bodyAdapters.js';
import { PreviewError } from '../errors.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { fetchPublicResponse } from '../remoteHttp.js';

const MAX_OEMBED_BYTES = 256_000;

export const youtubeOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isYoutubeVideoUrl,
  async fetch(requestedUrl, context) {
    const upstream = new URL('https://www.youtube.com/oembed');
    upstream.searchParams.set('url', requestedUrl.href);
    upstream.searchParams.set('format', 'json');
    const response = await fetchPublicResponse(upstream, {
      accept: 'application/json',
      userAgent: 'GKFeed/1.0',
      invalidRedirectMessage: 'YouTube returned an invalid redirect',
      tooManyRedirectsMessage: 'YouTube redirected too many times',
      upstreamMessage: (status) => `YouTube returned HTTP ${status}`,
      fetchFailedMessage: (timedOut) => timedOut
        ? 'YouTube took too long to respond'
        : 'YouTube could not be fetched',
      fetchFailedCode: 'fetch_failed',
    }, context);
    const payload = await readLimitedJson(response, {
      maximumBytes: MAX_OEMBED_BYTES,
      tooLarge: () => new PreviewError('The YouTube response is too large', 'response_too_large'),
      invalidJson: () => new PreviewError('YouTube returned invalid data', 'fetch_failed'),
      context,
    });
    const preview = parseYoutubeOEmbed(payload, requestedUrl);
    if (!preview) throw new PreviewError('YouTube returned incomplete metadata', 'fetch_failed');
    return preview;
  },
  parse: parseOpenGraph,
};

export function parseYoutubeOEmbed(value: unknown, pageUrl: URL): OpenGraphPreview | null {
  if (!isRecord(value) || !isYoutubeVideoUrl(pageUrl)) return null;
  const title = getStringProperty(value, 'title')?.trim();
  if (!title) return null;

  return {
    url: pageUrl.href,
    title,
    description: null,
    image: parseHttpUrl(getStringProperty(value, 'thumbnail_url')),
    video: null,
    siteName: 'YouTube',
    type: 'video',
    providerData: null,
  };
}

function parseHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

import { parseHTML } from 'linkedom';

import {
  isYoutubeChannelId,
  parseYoutubeChannelUrl,
  permanentYoutubeChannelUrl,
  type YoutubeChannelResolution,
} from '../shared/youtubeChannel.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { fetchHtml } from './preview/pageFetcher.js';

const MAX_CHANNEL_PAGE_BYTES = 3_000_000;

export async function resolveYoutubeChannel(
  input: string,
  context?: RequestExecutionContext,
): Promise<YoutubeChannelResolution> {
  const channel = parseYoutubeChannelUrl(input);
  if (!channel) throw new PreviewError('Invalid YouTube channel URL', 'invalid_url');
  if (channel.channelId) {
    return { channelId: channel.channelId, url: permanentYoutubeChannelUrl(channel.channelId, channel.tab) };
  }

  // Fetch the channel root, so an unavailable tab cannot change channel identity.
  // The shared fetcher bounds the body/deadline and validates public redirects.
  // YouTube puts canonical/RSS tags after a large inline stylesheet, beyond
  // the generic 256 kB metadata limit. Keep a bounded channel-specific limit.
  const page = await fetchHtml(new URL(channel.pageUrl), undefined, { maxBytes: MAX_CHANNEL_PAGE_BYTES }, context);
  if (!parseYoutubeChannelUrl(page.url.href)) {
    throw new PreviewError('YouTube did not return a channel page', 'youtube_channel_unresolved');
  }
  const channelId = parseYoutubeChannelId(page.html, page.url);
  return { channelId, url: permanentYoutubeChannelUrl(channelId, channel.tab) };
}

/** Only page-level metadata is trusted, never IDs of recommended videos/channels. */
export function parseYoutubeChannelId(html: string, pageUrl: URL): string {
  const { document } = parseHTML(html);
  const ids = new Set<string>();
  // YouTube currently emits canonical/OG/RSS tags in the body before the app.
  // Their metadata role identifies the page; generic body channelId tags do not.
  for (const element of document.querySelectorAll('link[rel="canonical"], link[rel="alternate"][type="application/rss+xml"], meta[property="og:url"], head meta[itemprop="channelId"]')) {
    const rel = element.getAttribute('rel')?.toLowerCase();
    const property = element.getAttribute('property')?.toLowerCase();
    const itemprop = element.getAttribute('itemprop')?.toLowerCase();
    if (itemprop === 'channelid') {
      const id = element.getAttribute('content');
      if (isYoutubeChannelId(id)) ids.add(id);
    }
    const value = rel === 'canonical' || (rel === 'alternate' && element.getAttribute('type') === 'application/rss+xml')
      ? element.getAttribute('href')
      : property === 'og:url' ? element.getAttribute('content') : null;
    if (!value) continue;
    try {
      const url = new URL(value, pageUrl);
      const channel = parseYoutubeChannelUrl(url.href);
      if (channel?.channelId) ids.add(channel.channelId);
      if (rel === 'alternate'
        && url.origin === 'https://www.youtube.com'
        && url.pathname === '/feeds/videos.xml') {
        const id = url.searchParams.get('channel_id');
        if (isYoutubeChannelId(id)) ids.add(id);
      }
    } catch {
      // Malformed metadata is not evidence of a channel ID.
    }
  }
  const redirectedId = parseYoutubeChannelUrl(pageUrl.href)?.channelId;
  if (redirectedId) ids.add(redirectedId);
  if (ids.size !== 1) {
    throw new PreviewError('YouTube channel ID is missing or inconsistent', 'youtube_channel_unresolved');
  }
  return [...ids][0];
}

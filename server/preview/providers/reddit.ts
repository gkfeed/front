import { parseHTML } from 'linkedom';

import { isRedditVideoUrl, normalizeHostname } from '../../../shared/urlRules.js';
import { PreviewError } from '../errors.js';
import { resolveHttpUrl } from '../html.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { fetchHtml } from '../pageFetcher.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';

const POST_PATH = /\/comments\/([a-z0-9]+)(?:\/|$)/i;

export const redditOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches(url) {
    const hostname = normalizeHostname(url.hostname);
    return (hostname === 'reddit.com' || hostname.endsWith('.reddit.com'))
      && POST_PATH.test(url.pathname);
  },
  async fetch(requestedUrl, context) {
    // The crawler page on www.reddit.com only contains a generated share image.
    // Old Reddit includes the post title, poster, and HLS stream with audio.
    const postUrl = new URL(requestedUrl.href);
    postUrl.hostname = 'old.reddit.com';
    postUrl.search = '';
    postUrl.hash = '';
    try {
      const page = await fetchHtml(postUrl, TWITTERBOT_USER_AGENT, {}, context);
      return parseRedditOpenGraph(page.html, requestedUrl);
    } catch (error) {
      if (!(error instanceof PreviewError)
        || !['upstream_error', 'fetch_failed', 'not_html'].includes(error.kind)
        || context?.signal.aborted) throw error;
      const page = await fetchHtml(requestedUrl, TWITTERBOT_USER_AGENT, {}, context);
      return parseRedditOpenGraph(page.html, requestedUrl);
    }
  },
  parse: parseRedditOpenGraph,
};

function parseRedditOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  const postId = pageUrl.pathname.match(POST_PATH)?.[1];
  const { document } = parseHTML(html);
  const post = postId ? document.querySelector(`[data-fullname="t3_${postId}"], shreddit-post[id="t3_${postId}"]`) : null;
  const title = post?.querySelector('a.title')?.textContent?.trim()
    || post?.getAttribute('post-title');
  const body = post?.querySelector('.usertext-body, [slot="text-body"]')?.textContent?.trim();
  const isDeleted = Boolean(post && (
    post.classList.contains('removed')
    || post.classList.contains('deleted')
    || ['is-removed', 'is-deleted'].some((attribute) => ['', 'true'].includes(post.getAttribute(attribute) ?? 'false'))
    || body === '[removed]'
    || body === '[deleted]'
  ));
  const player = post?.querySelector('[data-hls-url]');
  const stream = resolveHttpUrl(player?.getAttribute('data-hls-url'), pageUrl);
  const video = stream && isRedditVideoUrl(new URL(stream)) ? stream : preview.video;

  return {
    ...preview,
    title: title || preview.title?.replace(/^From the .+? community on Reddit:\s*/i, '') || null,
    image: isDeleted ? null : preview.image,
    video: isDeleted ? null : video,
    siteName: 'Reddit',
    type: isDeleted ? null : video ? 'video' : preview.type,
    providerData: isDeleted ? { provider: 'reddit', status: 'deleted' } as const : null,
  };
}

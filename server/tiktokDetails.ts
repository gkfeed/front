import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import {
  emptyTikTokDetails,
  parseTikTokDetails,
  parseTikTokOEmbedDetails,
  type TikTokDetails,
} from './tiktokDetailsParser.js';
import {
  fetchTikTokJson,
} from './tiktokJson.js';

export async function fetchTikTokDetails(
  videoUrl: URL,
  context?: RequestExecutionContext,
): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await fetchTikTokJson(upstream, 'details', context);
    if (response) {
      const details = parseTikTokDetails(response.value);
      if (details) return details;
    }
  } catch {
    // Fall through to TikTok's official oEmbed metadata.
  }

  return fetchTikTokOEmbedDetails(videoUrl, context);
}

async function fetchTikTokOEmbedDetails(
  videoUrl: URL,
  context?: RequestExecutionContext,
): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tiktok.com/oembed');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await fetchTikTokJson(upstream, 'oembed', context);
    return response ? parseTikTokOEmbedDetails(response.value) : emptyTikTokDetails();
  } catch {
    return emptyTikTokDetails();
  }
}

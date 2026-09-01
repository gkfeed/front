import { decodeHtml } from '../html.js';
import { isInstagramMediaUrl } from '../../../shared/urlRules.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { TWITTERBOT_USER_AGENT } from '../previewFetchers.js';

export const instagramOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isInstagramMediaUrl,
  async fetch(requestedUrl, context) {
    const embedUrl = new URL(requestedUrl.href);
    embedUrl.protocol = 'https:';
    embedUrl.hostname = 'www.instagram.com';
    embedUrl.search = '';
    embedUrl.hash = '';
    embedUrl.pathname = `${embedUrl.pathname
      .replace(/^\/reels\//i, '/reel/')
      .replace(/\/$/, '')}/embed/`;
    const page = await fetchHtml(embedUrl, TWITTERBOT_USER_AGENT, {}, context);
    return parseInstagramOpenGraph(page.html, requestedUrl);
  },
  parse: parseInstagramOpenGraph,
};

function parseInstagramOpenGraph(html: string, pageUrl: URL) {
  const preview = parseOpenGraph(html, pageUrl);
  const media = parseInstagramEmbedMedia(html);
  if (!media) return preview;
  return {
    ...preview,
    image: preview.image ?? media.imageUrl,
    video: preview.video ?? media.videoUrl,
    type: media.type,
  };
}

export function parseInstagramEmbedMedia(
  html: string,
): { type: 'video' | 'photo'; videoUrl: string | null; imageUrl: string | null } | null {
  const normalized = html.replace(/\\"/g, '"');
  const mediaIndex = findInstagramMediaIndex(normalized);
  if (mediaIndex < 0) return null;

  const mediaData = normalized.slice(mediaIndex);
  const encodedImageUrl = mediaData.match(
    /"display_url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
  )?.[1];
  const imageUrl = decodeInstagramMediaUrl(encodedImageUrl);
  const videoVersions = mediaData.match(/"video_versions"\s*:\s*\[([\s\S]*?)\]/i)?.[1];
  if (
    /"is_video"\s*:\s*true/i.test(mediaData)
    || /"media_type"\s*:\s*2(?:\D|$)/i.test(mediaData)
    || videoVersions
  ) {
    const encodedVideoUrl = mediaData.match(
      /"video_url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    )?.[1] ?? videoVersions?.match(
      /"url"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    )?.[1];
    return {
      type: 'video',
      videoUrl: decodeInstagramMediaUrl(encodedVideoUrl),
      imageUrl,
    };
  }
  if (/"is_video"\s*:\s*false/i.test(mediaData)) {
    return { type: 'photo', videoUrl: null, imageUrl };
  }
  return null;
}

function findInstagramMediaIndex(html: string): number {
  for (const marker of [
    '"shortcode_media"',
    '"xdt_api__v1__media__shortcode__web_info"',
    '"video_versions"',
  ]) {
    const index = html.indexOf(marker);
    if (index >= 0) return index;
  }
  return -1;
}

function decodeInstagramMediaUrl(value: string | undefined): string | null {
  if (!value) return null;

  let decoded: unknown;
  try {
    const normalizedEscapes = value.replace(/\\{2,}(?=[/u])/g, '\\');
    decoded = JSON.parse(`"${normalizedEscapes}"`);
  } catch {
    return null;
  }
  if (typeof decoded !== 'string') return null;
  const decodedUrl = decodeHtml(decoded);

  let url: URL;
  try {
    url = new URL(decodedUrl);
  } catch {
    return null;
  }
  return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
}

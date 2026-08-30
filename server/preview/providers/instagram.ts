import { decodeHtml } from '../html.js';

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

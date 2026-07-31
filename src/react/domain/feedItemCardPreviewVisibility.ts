import type { FeedItemPreview } from './feedItemPreview';

export function resolveVisibleFeedItemCardPreview({
  preview,
  tiktokEmbedPreview,
  previewFailures,
  hasLiquipediaMatch,
}: {
  preview: FeedItemPreview | null;
  tiktokEmbedPreview: FeedItemPreview | null;
  previewFailures: number;
  hasLiquipediaMatch: boolean;
}): FeedItemPreview | null {
  if (hasLiquipediaMatch) return null;
  if (previewFailures === 1 && preview?.type === 'video') {
    return tiktokEmbedPreview ?? (preview.poster
      ? { src: preview.poster, alt: preview.alt }
      : null);
  }
  const fallbackPreview = getFallbackPreview(preview);
  if (previewFailures === 1 && fallbackPreview) return fallbackPreview;
  return previewFailures > 0 ? null : preview;
}

function getFallbackPreview(preview: FeedItemPreview | null): FeedItemPreview | null {
  const fallbackSource = preview && 'fallbackSrc' in preview && typeof preview.fallbackSrc === 'string'
    ? preview.fallbackSrc
    : null;
  return preview && fallbackSource
    ? { src: fallbackSource, alt: preview.alt }
    : null;
}

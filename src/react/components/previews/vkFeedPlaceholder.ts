const VK_FEED_PLACEHOLDER_ASPECT_RATIO_TOLERANCE = 0.003;
const VK_FEED_PLACEHOLDER_ASPECT_RATIOS = [
  1920 / 1010,
  1200 / 630,
  1280 / 675,
] as const;

export function isLikelyVkFeedPlaceholder(aspectRatio: number): boolean {
  return VK_FEED_PLACEHOLDER_ASPECT_RATIOS.some((placeholderAspectRatio) => (
    Math.abs(aspectRatio - placeholderAspectRatio)
      <= VK_FEED_PLACEHOLDER_ASPECT_RATIO_TOLERANCE
  ));
}

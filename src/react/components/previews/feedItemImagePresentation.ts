import type { CSSProperties } from 'react';

import { isLikelyVkFeedPlaceholder } from './vkFeedPlaceholder';

export type ImagePresentationProfile = 'standard' | 'vk';
export type ImageOrientation = 'portrait' | 'landscape' | 'square';

export type ImagePresentationMetrics = {
  src: string;
  aspectRatio: number;
  orientation: ImageOrientation;
};

export type ImagePresentationFacts = {
  orientation: ImageOrientation | undefined;
  isPlaceholder: boolean;
  style: CSSProperties;
  usesImageSurface: boolean;
};

const roundedImageMask = [
  'linear-gradient(#000 0 0) center / 100% calc(100% - 44px) no-repeat',
  'linear-gradient(#000 0 0) center / calc(100% - 44px) 100% no-repeat',
  'radial-gradient(circle at 22px 22px, #000 21.5px, transparent 22px) top left / 50% 50% no-repeat',
  'radial-gradient(circle at calc(100% - 22px) 22px, #000 21.5px, transparent 22px) top right / 50% 50% no-repeat',
  'radial-gradient(circle at 22px calc(100% - 22px), #000 21.5px, transparent 22px) bottom left / 50% 50% no-repeat',
  'radial-gradient(circle at calc(100% - 22px) calc(100% - 22px), #000 21.5px, transparent 22px) bottom right / 50% 50% no-repeat',
].join(', ');

export const imageClippingStyle: CSSProperties = {
  overflow: 'hidden',
  borderRadius: 22,
  clipPath: 'inset(0 round 22px)',
  WebkitMask: roundedImageMask,
  mask: roundedImageMask,
  contain: 'paint',
};

export function readImagePresentationMetrics(
  image: Pick<HTMLImageElement, 'naturalHeight' | 'naturalWidth'>,
  src: string,
): ImagePresentationMetrics | null {
  const { naturalHeight, naturalWidth } = image;
  if (naturalHeight <= 0 || naturalWidth <= 0) return null;

  return {
    src,
    aspectRatio: naturalWidth / naturalHeight,
    orientation: naturalWidth === naturalHeight
      ? 'square'
      : naturalWidth > naturalHeight ? 'landscape' : 'portrait',
  };
}

export function createImagePresentationFacts(
  profile: ImagePresentationProfile,
  metrics: ImagePresentationMetrics | null,
): ImagePresentationFacts {
  return {
    orientation: metrics?.orientation,
    isPlaceholder: profile === 'vk'
      && metrics !== null
      && isLikelyVkFeedPlaceholder(metrics.aspectRatio),
    usesImageSurface: profile === 'vk',
    style: {
      ...imageClippingStyle,
      ...(metrics ? {
        '--reader-media-aspect-ratio': metrics.aspectRatio,
      } as CSSProperties : {}),
    },
  };
}

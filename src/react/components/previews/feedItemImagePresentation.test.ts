import { describe, expect, it } from 'vitest';

import {
  createImagePresentationFacts,
  readImagePresentationMetrics,
} from './feedItemImagePresentation';

describe('image presentation', () => {
  it.each([
    [1200, 630, 'landscape'],
    [630, 1200, 'portrait'],
    [800, 800, 'square'],
  ] as const)('classifies %sx%s media as %s', (naturalWidth, naturalHeight, orientation) => {
    expect(readImagePresentationMetrics({ naturalWidth, naturalHeight }, 'image.jpg'))
      .toMatchObject({ orientation, aspectRatio: naturalWidth / naturalHeight });
  });

  it('keeps provider policy behind the presentation profile', () => {
    const metrics = readImagePresentationMetrics({ naturalWidth: 1920, naturalHeight: 1010 }, 'image.jpg');

    expect(createImagePresentationFacts('vk', metrics)).toMatchObject({
      isPlaceholder: true,
      usesImageSurface: true,
    });
    expect(createImagePresentationFacts('standard', metrics)).toMatchObject({
      isPlaceholder: false,
      usesImageSurface: false,
    });
  });

  it('publishes geometry only after valid image metrics are available', () => {
    expect(readImagePresentationMetrics({ naturalWidth: 0, naturalHeight: 0 }, 'image.jpg')).toBeNull();
    expect(createImagePresentationFacts('standard', null)).toMatchObject({
      orientation: undefined,
      isPlaceholder: false,
    });
  });
});

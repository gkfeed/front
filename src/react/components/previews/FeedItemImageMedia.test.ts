// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FeedItemImageMedia } from './FeedItemImageMedia';
import { isLikelyVkFeedPlaceholder } from './vkFeedPlaceholder';

describe('isLikelyVkFeedPlaceholder', () => {
  it('recognizes known VK service banner sizes', () => {
    expect(isLikelyVkFeedPlaceholder(1920 / 1010)).toBe(true);
    expect(isLikelyVkFeedPlaceholder(1200 / 630)).toBe(true);
    expect(isLikelyVkFeedPlaceholder(1280 / 675)).toBe(true);
  });

  it('does not treat regular landscape photos as the service banner', () => {
    expect(isLikelyVkFeedPlaceholder(16 / 9)).toBe(false);
    expect(isLikelyVkFeedPlaceholder(3 / 2)).toBe(false);
  });
});

describe('FeedItemImageMedia VK service banner', () => {
  it('marks the loaded VK preview from a real wall post for text-first layout', () => {
    render(createElement(FeedItemImageMedia, {
      href: 'https://vk.com/wall-1_2',
      hostname: 'VK channel',
      preview: { src: 'https://example.com/vk-placeholder.jpg', alt: 'VK preview' },
      isShortVideo: false,
      isTikTok: false,
      hltvImageScore: null,
      onPreviewError: vi.fn(),
      presentationProfile: 'vk',
    }));

    const image = screen.getByAltText('VK preview');
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1920 },
      naturalHeight: { configurable: true, value: 1010 },
    });
    fireEvent.load(image);

    expect(image.closest('a')?.hasAttribute('data-vk-feed-placeholder')).toBe(true);
  });
});

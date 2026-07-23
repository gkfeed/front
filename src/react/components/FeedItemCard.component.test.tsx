// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOpenGraphPreview } from '../services/openGraph';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';

vi.mock('../services/openGraph');

const getPreview = vi.mocked(getOpenGraphPreview);
const item: FeedItem = {
  id: 1,
  feedId: 2,
  link: 'https://example.com/story',
  title: 'Story',
  text: '',
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedItemCard Open Graph preview', () => {
  it('uses the BFF image when no local preview is available', async () => {
    getPreview.mockResolvedValue({
      url: item.link,
      title: item.title,
      description: null,
      image: 'https://example.com/cover.jpg',
      video: null,
      siteName: 'Example',
      type: 'article',
    });

    render(<FeedItemCard item={item} />);

    const image = await screen.findByAltText('Preview for Story');
    expect(image.getAttribute('src')).toBe('https://example.com/cover.jpg');
    expect(getPreview).toHaveBeenCalledWith(item.link, expect.any(AbortSignal));
  });

  it('does not call the BFF when the feed content contains an image', () => {
    render(<FeedItemCard item={{ ...item, text: '<img src="https://example.com/feed-cover.jpg">' }} />);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://example.com/feed-cover.jpg');
    expect(getPreview).not.toHaveBeenCalled();
  });

  it('renders direct Open Graph video with its image as a poster', async () => {
    getPreview.mockResolvedValue({
      url: item.link,
      title: item.title,
      description: null,
      image: 'https://example.com/poster.jpg',
      video: 'https://example.com/video.mp4',
      siteName: 'Example',
      type: 'video',
    });

    render(<FeedItemCard item={item} />);

    const video = await screen.findByLabelText('Video preview for Story');
    expect(video.getAttribute('src')).toBe('https://example.com/video.mp4');
    expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg');
  });
});

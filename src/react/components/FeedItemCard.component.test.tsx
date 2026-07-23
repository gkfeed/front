// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  it('renders a short-lived Open Graph stream in the TikTok media card', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.tiktok.com/@creator/video/123',
      title: 'Creator video',
      description: null,
      image: 'https://example.com/tiktok-poster.jpg',
      video: 'https://video.example.com/playback?id=123',
      siteName: 'TikTok',
      type: 'video',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.tiktok.com/@creator/video/123',
    }} />);

    const video = await screen.findByLabelText('Video preview for Creator video') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('https://video.example.com/playback?id=123');
    expect(video.getAttribute('preload')).toBe('auto');
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(false);
    expect(video.closest('.reader-card__preview--tiktok')).toBeTruthy();
    expect(screen.queryByText('tiktok.com')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Story' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
    expect(video.closest('.reader-card--tiktok')).toBeTruthy();

    fireEvent.error(video);
    expect(screen.getByTitle('Video preview for Story').tagName).toBe('IFRAME');
  });

  it('uses TikTok’s autoplay player when Open Graph only provides a poster', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.tiktok.com/@creator/video/456',
      title: 'Creator video',
      description: null,
      image: 'https://example.com/tiktok-poster.jpg',
      video: null,
      siteName: 'TikTok',
      type: 'video',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.tiktok.com/@creator/video/456',
    }} />);

    const player = screen.getByTitle('Video preview for Story');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('allow')).toContain('autoplay');
    expect(player.getAttribute('src')).toContain('/player/v1/456?');
    expect(player.getAttribute('src')).toContain('autoplay=1');
    expect(player.getAttribute('src')).toContain('muted=0');
  });
});

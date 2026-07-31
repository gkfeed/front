// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard media providers', () => {
  it('renders direct Open Graph video with its image as a poster', async () => {
    getPreview.mockResolvedValue({
      url: item.link,
      title: item.title,
      description: null,
      image: 'https://example.com/poster.jpg',
      video: 'https://example.com/video.mp4',
      siteName: 'Example',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={item} />);

    const video = await screen.findByLabelText('Video preview for Story') as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe('https://example.com/video.mp4');
    expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg');
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.muted).toBe(false);
    expect(video.playsInline).toBe(true);
  });

  it('sizes a direct video from its intrinsic aspect ratio', async () => {
    getPreview.mockResolvedValue({
      url: item.link,
      title: item.title,
      description: null,
      image: null,
      video: 'https://example.com/portrait.mp4',
      siteName: 'Example',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={item} />);

    const video = await screen.findByLabelText('Video preview for Story');
    Object.defineProperties(video, {
      videoWidth: { configurable: true, value: 720 },
      videoHeight: { configurable: true, value: 1280 },
    });
    fireEvent.loadedMetadata(video);

    const preview = video.closest('.reader-card__preview');
    expect(preview?.classList.contains('reader-card__preview--video-adaptive')).toBe(true);
    expect(preview?.getAttribute('style')).toContain('aspect-ratio: 0.5625');
  });

  it('autoplays muted on iPhone and offers a user gesture to enable sound', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://files.example.com/story.mp4',
      title: 'inst: creator',
    }} />);

    const video = screen.getByLabelText('Video preview for inst: creator') as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(screen.getByRole('button', { name: 'Tap for sound' })).toBeTruthy();
  });

  it('renders Instagram media as an identified short-video card', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://files.catbox.moe/story.mp4',
      title: 'inst: marcian0chka',
    }} />);

    const video = screen.getByLabelText('Video preview for inst: marcian0chka');
    const card = video.closest('.reader-card');
    expect(card?.classList.contains('reader-card--short-video')).toBe(true);
    expect(card?.classList.contains('reader-card--instagram')).toBe(true);
    expect(video.closest('.reader-card__preview--short-video')).toBeTruthy();
    const identity = screen.getByText('marcian0chka').closest('.reader-card__short-video-identity');
    expect(identity).toBeTruthy();
    expect(identity?.parentElement).toBe(card);
    expect(screen.queryByText('files.catbox.moe')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
  });

  it('identifies an Instagram base64 description image as a photo post', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.instagram.com/p/example/',
      title: 'inst: photographer',
      text: '<img src="data:image/png;base64,iVBORw0KGgo=">',
    }} />);

    const image = screen.getByAltText('Preview for inst: photographer');
    expect(image.closest('.reader-card--instagram-photo')).toBeTruthy();
    expect(image.closest('.reader-card--short-video')).toBeTruthy();
  });

  it('renders TikTok’s static player without calling the Open Graph BFF', () => {
    getPreview.mockResolvedValue({
      url: 'https://www.tiktok.com/@creator/video/123',
      title: 'Creator video',
      description: null,
      image: 'https://example.com/tiktok-poster.jpg',
      video: 'https://video.example.com/playback?id=123',
      siteName: 'TikTok',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.tiktok.com/@creator/video/123',
    }} />);

    const player = screen.getByTitle('Video preview for Story');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src')).toContain('/player/v1/123?');
    expect(screen.queryByText('tiktok.com')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Story' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
    expect(player.closest('.reader-card--tiktok')).toBeTruthy();
    expect(getPreview).not.toHaveBeenCalled();
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
      providerData: null,
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

  it('autoplays TikTok on iPhone and offers a user gesture to enable sound', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.tiktok.com/@creator/video/789',
    }} />);

    expect(screen.getByTitle('Video preview for Story').getAttribute('src')).toContain('autoplay=1');
    expect(screen.getByRole('button', { name: 'Tap for sound' })).toBeTruthy();
  });
});

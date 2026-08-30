// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard media providers', () => {
  it('replaces a Spotify playlist cover with the embed player when clicked', async () => {
    getPreview.mockResolvedValue({
      url: 'https://open.spotify.com/playlist/37i9dQZEVXbeUwP0nygk6B',
      title: 'Release Radar',
      description: null,
      image: 'https://example.com/release-radar.jpg',
      video: null,
      siteName: 'Spotify',
      type: 'music.playlist',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://open.spotify.com/playlist/37i9dQZEVXbeUwP0nygk6B?si=example',
      title: 'Release Radar',
    }} />);

    const cover = await screen.findByRole('button', {
      name: 'Play Release Radar on Spotify',
    });
    expect(screen.queryByTitle('Spotify player: Release Radar')).toBeNull();

    fireEvent.click(cover);

    const player = screen.getByTitle('Spotify player: Release Radar');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src')).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQZEVXbeUwP0nygk6B',
    );
    expect(player.getAttribute('allow')).toContain('encrypted-media');
    expect(player.getAttribute('height')).toBe('352');
  });

  it('replaces a Spotify album cover with a large album embed', async () => {
    getPreview.mockResolvedValue({
      url: 'https://open.spotify.com/album/5n9oHQlYB2XRQZqFrJILxx',
      title: 'Badcurt - Нокаут',
      description: null,
      image: 'https://example.com/badcurt.jpg',
      video: null,
      siteName: 'Spotify',
      type: 'music.album',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://open.spotify.com/album/5n9oHQlYB2XRQZqFrJILxx',
      title: 'Badcurt - Нокаут',
    }} />);

    fireEvent.click(await screen.findByRole('button', {
      name: 'Play Badcurt - Нокаут on Spotify',
    }));

    const player = screen.getByTitle('Spotify player: Badcurt - Нокаут');
    expect(player.getAttribute('src')).toBe(
      'https://open.spotify.com/embed/album/5n9oHQlYB2XRQZqFrJILxx',
    );
    expect(player.getAttribute('height')).toBe('352');
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

  it('renders an extensionless Instagram story download as a story card', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://tempfile.org/XGVf8L8Htm1/download',
      title: 'inst: kozyrevaaaaaaa',
    }} />);

    const video = screen.getByLabelText('Video preview for inst: kozyrevaaaaaaa');
    const card = video.closest('.reader-card');
    expect(card?.classList.contains('reader-card--short-video')).toBe(true);
    expect(card?.classList.contains('reader-card--instagram')).toBe(true);
    expect(video.closest('.reader-card__preview--short-video')).toBeTruthy();
    expect(screen.getByText('kozyrevaaaaaaa')).toBeTruthy();
  });

  it('plays an Instagram Reel from the extracted media URL', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.instagram.com/reel/AbC_123/?igsh=example',
      title: 'Video',
      description: null,
      image: 'https://example.com/poster.jpg',
      video: 'https://scontent.cdninstagram.com/reel.mp4?token=example',
      siteName: 'Instagram',
      type: 'video',
      providerData: null,
    });
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.instagram.com/reel/AbC_123/?igsh=example',
      title: 'inst: creator',
    }} />);

    const player = await screen.findByLabelText('Video preview for Video');
    expect(player.tagName).toBe('VIDEO');
    expect(player.getAttribute('src'))
      .toBe('https://scontent.cdninstagram.com/reel.mp4?token=example');
    expect(player.getAttribute('poster')).toBe('https://example.com/poster.jpg');
    expect(player.closest('.reader-card--instagram')).toBeTruthy();
    expect(getPreview).toHaveBeenCalledWith(
      'https://www.instagram.com/reel/AbC_123/?igsh=example',
      expect.anything(),
    );
  });

  it('shows the Instagram poster instead of an embed when the video URL is unavailable', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.instagram.com/p/DceBK9qkav0/',
      title: 'Video',
      description: null,
      image: 'https://scontent.cdninstagram.com/poster.jpg',
      video: null,
      siteName: 'Instagram',
      type: 'video',
      providerData: null,
    });
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.instagram.com/p/DceBK9qkav0/',
      title: 'inst: creator',
    }} />);

    const poster = await screen.findByAltText('Preview for Video');
    expect(poster.tagName).toBe('IMG');
    expect(poster.getAttribute('src')).toBe('https://scontent.cdninstagram.com/poster.jpg');
    expect(screen.queryByTitle('Video preview for inst: creator')).toBeNull();
  });

  it('keeps a photo from a universal Instagram post path as an image', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.instagram.com/p/example/',
      title: 'Photo',
      description: null,
      image: 'https://example.com/photo.jpg',
      video: null,
      siteName: 'Instagram',
      type: 'photo',
      providerData: null,
    });
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.instagram.com/p/example/',
      title: 'inst: photographer',
      text: '<img src="data:image/png;base64,iVBORw0KGgo=">',
    }} />);

    const image = await screen.findByAltText('Preview for inst: photographer');
    expect(image.closest('.reader-card--instagram-photo')).toBeTruthy();
    expect(image.closest('.reader-card--portrait-image')).toBeTruthy();
    expect(screen.queryByTitle('Video preview for inst: photographer')).toBeNull();
  });

  it('plays a video published under a universal Instagram post path', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.instagram.com/p/DcZUpIItbZu/',
      title: 'Video',
      description: null,
      image: 'https://example.com/poster.jpg',
      video: 'https://scontent.cdninstagram.com/video.mp4?token=example',
      siteName: 'Instagram',
      type: 'video',
      providerData: null,
    });
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.instagram.com/p/DcZUpIItbZu/',
      title: 'inst: mibreoo',
      text: '<img src="https://example.com/poster.jpg">',
    }} />);

    const player = await screen.findByLabelText('Video preview for Video');
    expect(player.tagName).toBe('VIDEO');
    expect(player.getAttribute('src'))
      .toBe('https://scontent.cdninstagram.com/video.mp4?token=example');
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
    const card = player.closest('.reader-card--tiktok');
    expect(card?.getAttribute('data-comments-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Show comments' }));

    expect(card?.getAttribute('data-comments-expanded')).toBe('true');
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

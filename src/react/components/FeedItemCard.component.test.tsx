// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLiquipediaMatchPreview } from '../services/liquipedia';
import { getOpenGraphPreview } from '../services/openGraph';
import { clearPreviewCache } from '../services/previewQueue';
import { NsfwPreferencesContext } from '../state/nsfwPreferencesContext';
import type { FeedItem } from '../types';
import { FeedItemCard } from './FeedItemCard';

vi.mock('../services/openGraph');
vi.mock('../services/liquipedia');

const getPreview = vi.mocked(getOpenGraphPreview);
const getLiquipediaPreview = vi.mocked(getLiquipediaMatchPreview);
const item: FeedItem = {
  id: 1,
  feedId: 2,
  link: 'https://example.com/story',
  title: 'Story',
  text: '',
};

afterEach(() => {
  cleanup();
  clearPreviewCache();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('FeedItemCard Open Graph preview', () => {
  it('blurs supported NSFW sources by default', () => {
    const { container, rerender } = render(<FeedItemCard item={{
      ...item,
      link: 'https://www.pornhub.com/view_video.php?viewkey=123',
    }} />);

    expect(container.querySelector('.reader-card--nsfw-blurred')).toBeTruthy();
    expect(screen.getByText('Hidden by settings')).toBeTruthy();

    rerender(<FeedItemCard item={{
      ...item,
      link: 'https://porno365.example/video/123',
    }} />);

    expect(container.querySelector('.reader-card--nsfw-blurred')).toBeTruthy();
  });

  it('does not render NSFW cards in hide mode', () => {
    const { container } = render(
      <NsfwPreferencesContext value={{ nsfwMode: 'hide', setNsfwMode: vi.fn() }}>
        <FeedItemCard item={{
          ...item,
          link: 'https://www.pornhub.com/view_video.php?viewkey=123',
        }} />
      </NsfwPreferencesContext>,
    );

    expect(container.querySelector('.reader-card')).toBeNull();
    expect(getPreview).not.toHaveBeenCalled();
  });

  it('uses a max-resolution YouTube thumbnail with a reliable fallback', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    const image = screen.getByAltText('Preview for Story');
    expect(image.getAttribute('src')).toBe('https://i.ytimg.com/vi/abc123xyz/maxresdefault.jpg');

    fireEvent.error(image);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg');
  });

  it('opens a YouTube player in theater mode when the card is clicked', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
      text: 'Example video',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Example video' }));

    const player = screen.getByTitle('Example video');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src'))
      .toBe('https://www.youtube-nocookie.com/embed/abc123xyz?autoplay=1&rel=0');
    expect(player.getAttribute('allow')).toContain('autoplay');
    expect(screen.queryByAltText('Preview for Story')).toBeNull();
    expect(screen.getByRole('button', { name: 'Exit theater mode' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);
  });

  it('toggles theater mode without reloading the YouTube player', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
      text: 'Example video',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Example video' }));
    const player = screen.getByTitle('Example video');

    fireEvent.click(screen.getByRole('button', { name: 'Exit theater mode' }));

    expect(screen.getByTitle('Example video')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' }).getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Enter theater mode' }));

    expect(screen.getByTitle('Example video')).toBe(player);
    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('Example video')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });

  it('exposes the card action as a native button', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://youtu.be/abc123xyz',
    }} />);

    const trigger = screen.getByRole('button', { name: 'Play video Story' });
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.getAttribute('type')).toBe('button');
  });

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
    expect(image.closest('a')?.getAttribute('href')).toBe(item.link);
    expect(screen.getByRole('heading', { name: 'Story' })).toBeTruthy();
    expect(screen.queryByText('example.com')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
    expect(getPreview).toHaveBeenCalledWith(item.link, expect.any(AbortSignal));
  });

  it('defers remote previews until the card approaches the viewport', async () => {
    let reveal: () => void = () => undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        reveal = () => callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }

      observe() {}
      disconnect() {}
    });
    getPreview.mockResolvedValue({
      url: item.link,
      title: item.title,
      description: null,
      image: 'https://example.com/lazy.jpg',
      video: null,
      siteName: 'Example',
      type: 'article',
    });

    render(<FeedItemCard item={item} />);
    expect(getPreview).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Loading preview')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Story' })).toBeNull();

    act(reveal);

    expect(await screen.findByAltText('Preview for Story')).toBeTruthy();
    expect(screen.queryByLabelText('Loading preview')).toBeNull();
    expect(getPreview).toHaveBeenCalledTimes(1);
  });

  it('shows generated Reddit cards without duplicating their content', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.reddit.com/r/neovim/comments/abc123/post/',
      title: 'Reddit post',
      description: null,
      image: '/api/bff/reddit-preview-image?url=encoded',
      video: null,
      siteName: 'Reddit',
      type: 'website',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.reddit.com/r/neovim/comments/abc123/post/',
      title: 'Duplicated Reddit title',
    }} />);

    const image = await screen.findByAltText('Preview for Reddit post');
    expect(image.closest('.reader-card--image-preview')).toBeTruthy();
    expect(image.closest('.reader-card--reddit-preview')).toBeTruthy();
    expect(screen.queryByText('reddit.com')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Duplicated Reddit title' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
  });

  it('shows an HLTV Open Graph match image without duplicating its content', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/og-vs-spirit-blast-bounty-2026-season-2',
      title: 'OG vs Spirit at BLAST Bounty 2026 Season 2',
      description: 'Complete overview of the OG vs. Spirit matchup',
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      matchStartsAt: '2999-07-23T18:05:00.000Z',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/og-vs-spirit-blast-bounty-2026-season-2',
      title: 'OG vs Spirit',
      text: 'Upcoming match: OG vs Spirit',
    }} />);

    const image = await screen.findByAltText('Preview for OG vs Spirit at BLAST Bounty 2026 Season 2');
    expect(image.getAttribute('src')).toBe('https://api.url2png.com/v6/account/signature/png/?url=match');
    expect(image.closest('.reader-card--image-preview')).toBeTruthy();
    expect(image.closest('.reader-card--reddit-preview')).toBeNull();
    expect(screen.queryByText('hltv.org')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'OG vs Spirit' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
    expect(screen.getByText(/^Starts in /)).toBeTruthy();
  });

  it('does not show an HLTV countdown after the match start', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
      title: 'OG vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      matchStartsAt: '2000-01-01T00:00:00.000Z',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
    }} />);

    expect(await screen.findByAltText('Preview for OG vs Spirit')).toBeTruthy();
    expect(screen.queryByText(/^Starts in /)).toBeNull();
  });

  it('overlays the final score on a generated HLTV match image', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      matchStartsAt: '2026-07-23T18:05:00.000Z',
      matchTeams: [
        { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
        { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
      ],
      matchStatus: 'over',
      matchScore: ['1', '2'],
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
    }} />);

    expect(await screen.findByAltText('Preview for Liquid vs Spirit')).toBeTruthy();
    expect(screen.getByText('1 : 2')).toBeTruthy();
    expect(screen.getByRole('link', {
      name: 'Open Liquid vs Spirit, final score 1 to 2',
    })).toBeTruthy();
  });

  it('converts a generated HLTV image into the live matchup format', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      matchStartsAt: '2026-07-23T18:05:00.000Z',
      matchTeams: [
        { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
        { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
      ],
      matchStatus: 'live',
      matchScore: ['1', '0'],
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
    }} />);

    expect(await screen.findByRole('link', {
      name: 'Liquid versus Spirit, live score 1 to 0',
    })).toBeTruthy();
    expect(screen.queryByAltText('Preview for Liquid vs Spirit')).toBeNull();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('replaces the generic HLTV image with a team matchup', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396281/ence-vs-bojong-event',
      title: 'HLTV.org - The home of competitive Counter-Strike',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: null,
      matchStartsAt: null,
      matchTeams: [
        { name: 'ENCE', logo: 'https://img-cdn.hltv.org/teamlogo/ence.png' },
        { name: 'BOJONG', logo: 'https://img-cdn.hltv.org/teamlogo/bojong.png' },
      ],
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396281/ence-vs-bojong-event',
    }} />);

    expect(await screen.findByRole('link', { name: 'ENCE versus BOJONG' })).toBeTruthy();
    expect(screen.getByText('ENCE')).toBeTruthy();
    expect(screen.getByText('BOJONG')).toBeTruthy();
    expect(screen.queryByAltText(/HLTV/)).toBeNull();
  });

  it('shows and refreshes the score while an HLTV match is live', async () => {
    vi.useFakeTimers();
    const basePreview = {
      url: 'https://www.hltv.org/matches/2396277/ww-vs-tdk-event',
      title: 'WW vs TDK',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: null,
      matchStartsAt: '2026-07-30T10:00:00.000Z',
      matchTeams: [
        { name: 'WW', logo: 'https://img-cdn.hltv.org/teamlogo/ww.png' },
        { name: 'TDK', logo: 'https://img-cdn.hltv.org/teamlogo/tdk.png' },
      ] as [{ name: string; logo: string }, { name: string; logo: string }],
      matchStatus: 'live' as const,
    };
    getPreview
      .mockResolvedValueOnce({ ...basePreview, matchScore: ['1', '0'] })
      .mockResolvedValueOnce({
        ...basePreview,
        matchStatus: 'over',
        matchScore: ['1', '2'],
      });

    render(<FeedItemCard item={{ ...item, link: basePreview.url }} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('link', {
      name: 'WW versus TDK, live score 1 to 0',
    })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(screen.getByRole('link', {
      name: 'WW versus TDK, final score 1 to 2',
    })).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getPreview).toHaveBeenCalledTimes(2);
  });

  it('does not call the BFF when the feed content contains an image', () => {
    render(<FeedItemCard item={{ ...item, text: '<img src="https://example.com/feed-cover.jpg">' }} />);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://example.com/feed-cover.jpg');
    expect(getPreview).not.toHaveBeenCalled();
  });

  it('replaces a small Rezka feed image with the original remote cover', async () => {
    getPreview.mockResolvedValue({
      url: 'https://rezka.ag/films/drama/123-story.html',
      title: 'Story',
      description: null,
      image: 'https://static.hdrezka.ac/covers/original.jpg',
      video: null,
      siteName: 'HDrezka',
      type: 'video.movie',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://hdrezka.me/films/drama/123-story.html',
      text: '<img src="https://static.hdrezka.ac/covers/thumbnail.jpg">',
    }} />);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/thumbnail.jpg');
    expect((await screen.findByAltText('Preview for Story')).getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/original.jpg');
    expect(getPreview).toHaveBeenCalledWith(
      'https://hdrezka.me/films/drama/123-story.html',
      expect.any(AbortSignal),
    );

    fireEvent.error(screen.getByAltText('Preview for Story'));
    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/thumbnail.jpg');
  });

  it('shows readable feed text as the description for VK items', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '<p>Новый пост сообщества</p><img src="https://example.com/vk-cover.jpg">',
    }} />);

    expect(screen.getByText('Новый пост сообщества')).toBeTruthy();
  });

  it('loads a VK description when local feed content only contains media', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      description: 'Описание публикации',
      image: 'https://example.com/og-cover.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '<img src="https://example.com/feed-cover.jpg">',
    }} />);

    expect(await screen.findByText('Описание публикации')).toBeTruthy();
    expect(getPreview).toHaveBeenCalled();
  });

  it('renders VK video links in the embedded player', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/video-123_456',
      title: 'VK clip',
      text: 'Описание ролика',
    }} />);

    const player = screen.getByTitle('Video preview for VK clip');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src'))
      .toBe('https://vk.com/video_ext.php?oid=-123&id=456&hd=2&autoplay=1');
    expect(player.getAttribute('allow')).toContain('fullscreen');
  });

  it('renders a VK wall video discovered by the remote preview', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.ru/wall-28905875_36129480',
      title: 'Рифмы и Панчи',
      description: 'Описание ролика',
      image: 'https://iv.okcdn.ru/getVideoPreview?id=123',
      video: 'https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret',
      siteName: 'VK',
      type: 'article',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-28905875_36129480',
      title: 'Рифмы и Панчи',
      text: 'ФИДБЭК ПО СВИДАНИЮ',
    }} />);

    const player = await screen.findByTitle('Video preview for Рифмы и Панчи');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src')).toBe(
      'https://vk.com/video_ext.php?oid=-28905875&id=456404323&hash=secret&autoplay=1',
    );
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

  it('renders a Liquipedia match summary instead of the generic hero image', async () => {
    getLiquipediaPreview.mockResolvedValue({
      date: 'June 21, 2026 - 10:00 CEST',
      status: 'finished',
      score: ['2', '0'],
      teams: [
        {
          name: 'Team Spirit',
          shortName: 'TSpirit',
          logo: 'https://liquipedia.net/commons/spirit.png',
          results: ['win', 'win', 'default'],
        },
        {
          name: 'VP.Prodigy',
          shortName: 'VP.P',
          logo: 'https://liquipedia.net/commons/vpp.png',
          results: ['loss', 'loss', 'default'],
        },
      ],
      tournament: 'The International 2026: Europe Regional Qualifier',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://liquipedia.net/dota2/Match%3AID_example',
      title: 'Team Spirit vs VP.P',
    }} />);

    expect(await screen.findByLabelText('Team Spirit 2 to 0 VP.Prodigy')).toBeTruthy();
    expect(screen.getByText('The International 2026: Europe Regional Qualifier')).toBeTruthy();
    expect(screen.getAllByLabelText('win')).toHaveLength(2);
    expect(screen.getAllByLabelText('loss')).toHaveLength(2);
    expect(getPreview).not.toHaveBeenCalled();
  });
});

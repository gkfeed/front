// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLiquipediaMatchPreview } from '../services/liquipedia';
import { getOpenGraphPreview } from '../services/openGraph';
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
  vi.resetAllMocks();
});

describe('FeedItemCard Open Graph preview', () => {
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

  it('creates a YouTube player when the card is clicked', () => {
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
  });

  it('toggles theater mode without reloading the YouTube player', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
      text: 'Example video',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Example video' }));
    const player = screen.getByTitle('Example video');

    fireEvent.click(screen.getByRole('button', { name: 'Enter theater mode' }));

    expect(screen.getByTitle('Example video')).toBe(player);
    expect(screen.getByRole('button', { name: 'Exit theater mode' }).getAttribute('aria-pressed')).toBe('true');
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
    expect(getPreview).toHaveBeenCalledWith(item.link, expect.any(AbortSignal));
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
    expect(screen.queryByText('hltv.org')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'OG vs Spirit' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
  });

  it('does not call the BFF when the feed content contains an image', () => {
    render(<FeedItemCard item={{ ...item, text: '<img src="https://example.com/feed-cover.jpg">' }} />);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://example.com/feed-cover.jpg');
    expect(getPreview).not.toHaveBeenCalled();
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

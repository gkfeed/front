// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard remote and feed previews', () => {
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
});

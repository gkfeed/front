// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getArticlePreview, getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard remote and feed previews', () => {
  it('opens an article preview inside the site when its cover is clicked', async () => {
    getPreview.mockResolvedValue({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      description: 'Описание статьи',
      image: 'https://trashbox.ru/images/cloudflare.webp',
      video: null,
      siteName: 'Trashbox.ru',
      type: 'article',
      providerData: null,
    });
    getArticlePreview.mockResolvedValue({
      url: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
      byline: 'Svidetel',
      excerpt: null,
      blocks: [{ type: 'paragraph', text: 'Полный текст статьи.' }],
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://trashbox.ru/link/cloudflare-os',
      title: 'Cloudflare OS',
    }} />);

    const cover = await screen.findByAltText('Preview for Cloudflare OS');
    fireEvent.click(cover);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Полный текст статьи.')).toBeTruthy();
    expect(getArticlePreview).toHaveBeenCalledWith(
      'https://trashbox.ru/link/cloudflare-os',
      expect.any(AbortSignal),
    );
  });

  it('shows generated Reddit cards without duplicating their content', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.reddit.com/r/neovim/comments/abc123/post/',
      title: 'Reddit post',
      description: null,
      image: '/bff/reddit-preview-image?url=encoded',
      video: null,
      siteName: 'Reddit',
      type: 'website',
      providerData: null,
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

  it('renders Reddit-hosted videos from Open Graph metadata', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.reddit.com/r/example/comments/abc123/post/',
      title: 'Reddit video',
      description: null,
      image: '/bff/reddit-preview-image?url=encoded',
      video: 'https://v.redd.it/video123',
      siteName: 'Reddit',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.reddit.com/r/example/comments/abc123/post/',
      text: '<img src="https://share.redd.it/preview/post/abc123">',
    }} />);

    const video = await screen.findByLabelText('Video preview for Reddit video');
    expect(video.tagName).toBe('VIDEO');
    expect(video.getAttribute('src')).toBe('https://v.redd.it/video123');
    expect(video.getAttribute('poster')).toBe('/bff/reddit-preview-image?url=encoded');
    expect(video.closest('.reader-card--reddit-preview')).toBeNull();
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
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://hdrezka.me/films/drama/123-story.html',
      text: '<img src="https://static.hdrezka.ac/covers/thumbnail.jpg">',
    }} />);

    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/thumbnail.jpg');
    await waitFor(() => expect(document.querySelector('[data-preview-preloader]')).toBeTruthy());
    fireEvent.load(document.querySelector('[data-preview-preloader]')!);
    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/original.jpg');
    expect(screen.getByAltText('Preview for Story').closest('.reader-card--rezka')).toBeTruthy();
    expect(getPreview).toHaveBeenCalledWith(
      'https://hdrezka.me/films/drama/123-story.html',
      expect.any(AbortSignal),
    );

    fireEvent.error(screen.getByAltText('Preview for Story'));
    expect(screen.getByAltText('Preview for Story').getAttribute('src'))
      .toBe('https://static.hdrezka.ac/covers/thumbnail.jpg');
  });

  it('replaces a cropped VK feed image while keeping the channel and post description', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      description: null,
      image: 'https://example.com/vk-original.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '<p>Новый пост сообщества</p><img src="https://example.com/vk-cropped.jpg">',
    }} />);

    const visibleImage = screen.getByAltText('Preview for Рифмы и Панчи');
    expect(visibleImage.getAttribute('src'))
      .toBe('https://example.com/vk-cropped.jpg');
    await waitFor(() => expect(document.querySelector('[data-preview-preloader]')).toBeTruthy());
    expect(screen.getByAltText('Preview for Рифмы и Панчи')).toBe(visibleImage);
    expect(visibleImage.getAttribute('src')).toBe('https://example.com/vk-cropped.jpg');
    fireEvent.load(document.querySelector('[data-preview-preloader]')!);
    expect(screen.getByAltText('Preview for Рифмы и Панчи')).toBe(visibleImage);
    expect(visibleImage.getAttribute('src'))
      .toBe('https://example.com/vk-original.jpg');
    expect(screen.getByRole('heading', { name: 'Рифмы и Панчи' })).toBeTruthy();
    expect(screen.getByText('Новый пост сообщества')).toBeTruthy();
    const copy = screen.getByText('Новый пост сообщества').closest('.reader-card__copy');
    expect(copy?.querySelector('.reader-card__description')?.nextElementSibling)
      .toBe(screen.getByRole('heading', { name: 'Рифмы и Панчи' }));
    expect(copy?.querySelector('.reader-card__vk-icon svg')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Рифмы и Панчи' }).getAttribute('href'))
      .toBe('https://vk.com/wall-123_456');
    expect(screen.queryByRole('link', { name: /Open original/i })).toBeNull();
    expect(getPreview).toHaveBeenCalledWith(
      'https://vk.com/wall-123_456',
      expect.any(AbortSignal),
    );

    fireEvent.error(screen.getByAltText('Preview for Рифмы и Панчи'));
    expect(screen.getByAltText('Preview for Рифмы и Панчи').getAttribute('src'))
      .toBe('https://example.com/vk-cropped.jpg');
  });

  it('shows every VK feed photo in a carousel and keeps the post link', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-187455013_1261115',
      title: 'League of Legends: Wild Rift',
      description: null,
      image: 'https://example.com/original-first.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-187455013_1261115',
      title: 'League of Legends: Wild Rift',
      text: '<img src="https://example.com/first.jpg"><img src="https://example.com/second.jpg"><img src="https://example.com/third.jpg">',
    }} />);

    const image = screen.getByAltText('Preview for League of Legends: Wild Rift (1/3)');
    expect(image.getAttribute('src')).toBe('https://example.com/first.jpg');
    expect(document.querySelector('.reader-card__vk-carousel-link')?.getAttribute('href'))
      .toBe('https://vk.com/wall-187455013_1261115');

    await waitFor(() => expect(document.querySelector('[data-preview-preloader]')).toBeTruthy());
    fireEvent.load(document.querySelector('[data-preview-preloader]')!);
    expect(image.getAttribute('src')).toBe('https://example.com/original-first.jpg');

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByAltText('Preview for League of Legends: Wild Rift (2/3)').getAttribute('src'))
      .toBe('https://example.com/second.jpg');
    screen.getByRole('button', { name: 'Next slide' }).focus();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByAltText('Preview for League of Legends: Wild Rift (3/3)').getAttribute('src'))
      .toBe('https://example.com/third.jpg');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByAltText('Preview for League of Legends: Wild Rift (2/3)').getAttribute('src'))
      .toBe('https://example.com/second.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByAltText('Preview for League of Legends: Wild Rift (1/3)').getAttribute('src'))
      .toBe('https://example.com/original-first.jpg');
  });

  it('shows VK photos supplied by remote metadata when the feed has one image', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-1_2',
      title: 'VK album',
      description: null,
      image: 'https://example.com/first.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: {
        provider: 'vk',
        images: ['https://example.com/first.jpg', 'https://example.com/second.jpg'],
      },
    });

    render(<FeedItemCard item={{ ...item, link: 'https://vk.com/wall-1_2' }} />);
    expect(await screen.findByAltText('Preview for VK album (1/2)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByAltText('Preview for VK album (2/2)').getAttribute('src'))
      .toBe('https://example.com/second.jpg');
  });

  it('keeps the feed photo when VK original fails to load', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-1_2',
      title: 'VK album',
      description: null,
      image: 'https://example.com/broken.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });
    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-1_2',
      text: '<img src="https://example.com/feed-first.jpg"><img src="https://example.com/second.jpg">',
    }} />);

    await waitFor(() => expect(document.querySelector('[data-preview-preloader]')).toBeTruthy());
    fireEvent.error(document.querySelector('[data-preview-preloader]')!);
    expect(screen.getByAltText('Preview for VK album (1/2)').getAttribute('src'))
      .toBe('https://example.com/feed-first.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByAltText('Preview for VK album (2/2)').getAttribute('src'))
      .toBe('https://example.com/second.jpg');
  });

  it('shows the VK channel but not a generic remote description', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      description: 'Описание публикации',
      image: null,
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '',
    }} />);

    expect(await screen.findByRole('heading', { name: 'Рифмы и Панчи' })).toBeTruthy();
    expect(screen.queryByText('Описание публикации')).toBeNull();
    expect(screen.getByRole('link', { name: 'Рифмы и Панчи' }).getAttribute('href'))
      .toBe('https://vk.com/wall-123_456');
    expect(screen.queryByRole('link', { name: /Open original/i })).toBeNull();
    expect(getPreview).toHaveBeenCalled();
  });

  it('shows feed text for a VK post without media', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      description: 'ВКонтакте — универсальное средство для общения',
      image: null,
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '<p>Новый пост сообщества</p>',
    }} />);

    expect(await screen.findByText('Новый пост сообщества')).toBeTruthy();
    expect(screen.queryByText('ВКонтакте — универсальное средство для общения')).toBeNull();
    expect(screen.getByRole('link', { name: 'Рифмы и Панчи' }).getAttribute('href'))
      .toBe('https://vk.com/wall-123_456');
    expect(screen.queryByRole('link', { name: /Open original/i })).toBeNull();
  });

  it('shows a deleted-post preview for a missing VK wall post', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.ru/wall-45277565_394259',
      title: null,
      description: null,
      image: null,
      video: null,
      siteName: null,
      type: null,
      providerData: { provider: 'vk', status: 'deleted' },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-45277565_394259',
      title: '36 студия | Русские комментарии NFL,NHL,MLB,NBA',
      text: '<p>Старый текст удалённого поста</p>',
    }} />);

    const deletedPreview = await screen.findByRole('link', { name: 'Post deleted' });
    expect(deletedPreview.getAttribute('href')).toBe('https://vk.com/wall-45277565_394259');
    expect(deletedPreview.closest('.reader-card--vk-deleted')).toBeTruthy();
    expect(screen.getByRole('heading', {
      name: '36 студия | Русские комментарии NFL,NHL,MLB,NBA',
    })).toBeTruthy();
    expect(screen.queryByText('Старый текст удалённого поста')).toBeNull();
  });

  it('renders VK images in a media-first card', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      description: 'Описание публикации',
      image: 'https://example.com/vk-cover.jpg',
      video: null,
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-123_456',
      title: 'Рифмы и Панчи',
      text: '',
    }} />);

    const image = await screen.findByAltText('Preview for Рифмы и Панчи');
    const card = image.closest('.reader-card--vk');
    expect(card).toBeTruthy();
    expect(image.closest('.reader-card__preview')?.parentElement).toBe(card);
    expect(card?.querySelector('.reader-card__copy')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Рифмы и Панчи' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Рифмы и Панчи' }).getAttribute('href'))
      .toBe('https://vk.com/wall-123_456');
    expect(screen.queryByRole('link', { name: /Open original/i })).toBeNull();
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
      .toBe('https://vk.com/video_ext.php?oid=-123&id=456&hd=2&autoplay=0&muted=0');
    expect(player.getAttribute('allow')).toContain('fullscreen');
  });

  it('plays a VK wall video through the first-party proxy', async () => {
    getPreview.mockResolvedValue({
      url: 'https://vk.ru/wall-28905875_36129480',
      title: 'Рифмы и Панчи',
      description: 'Описание ролика',
      image: 'https://iv.okcdn.ru/getVideoPreview?id=123',
      video: 'https://vk.ru/video_ext.php?oid=-28905875&id=456404323&hash=secret',
      siteName: 'VK',
      type: 'article',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://vk.com/wall-28905875_36129480',
      title: 'Рифмы и Панчи',
      text: 'ФИДБЭК ПО СВИДАНИЮ',
    }} />);

    const player = await screen.findByLabelText('Video preview for Рифмы и Панчи');
    expect(player.tagName).toBe('VIDEO');
    expect(player.getAttribute('src')).toBe(
      '/bff/vk-video?url=https%3A%2F%2Fvk.ru%2Fvideo_ext.php%3Foid%3D-28905875%26id%3D456404323%26hash%3Dsecret',
    );
    expect(player.getAttribute('poster')).toBe('https://iv.okcdn.ru/getVideoPreview?id=123');
    expect(document.querySelector('.reader-card--vk iframe')).toBeNull();
  });
});

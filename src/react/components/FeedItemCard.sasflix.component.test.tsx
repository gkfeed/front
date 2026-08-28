// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard Sasflix player', () => {
  it('opens the public HLS stream in theater mode', async () => {
    getPreview.mockResolvedValue({
      url: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
      title: 'Sasflix story',
      description: null,
      image: 'https://sasflix.ru/api/poster/eb1ddca7-d933-4ccf-99b6-4129a4a6730e?w=1024',
      video: 'https://sasflix.ru/api/video/eb1ddca7-d933-4ccf-99b6-4129a4a6730e.m3u8',
      siteName: 'Сасфликс',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
    }} />);

    expect(screen.getByRole('article').classList.contains('reader-card--sasflix')).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Play Sasflix video Story' }));

    const player = screen.getByTitle('Sasflix video player: Story');
    expect(player.tagName).toBe('VIDEO');
    expect(player.hasAttribute('controls')).toBe(true);
    expect(screen.getByRole('button', { name: 'Exit theater mode' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('Sasflix video player: Story')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });

  it('honors a click made while the Sasflix stream metadata is still loading', async () => {
    let resolvePreview!: (preview: Awaited<ReturnType<typeof getPreview>>) => void;
    const previewPromise = new Promise<Awaited<ReturnType<typeof getPreview>>>((resolve) => {
      resolvePreview = resolve;
    });
    getPreview.mockReturnValue(previewPromise);

    render(<FeedItemCard item={{
      ...item,
      link: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play Sasflix video Story' }));
    await act(async () => resolvePreview({
      url: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
      title: 'Story',
      description: null,
      image: 'https://sasflix.ru/api/image/cover',
      video: 'https://sasflix.ru/api/video/5de7049e-1998-4c6d-995d-a6086dbab25b.m3u8',
      siteName: 'Сасфликс',
      type: 'video',
      providerData: null,
    }));

    expect(await screen.findByTitle('Sasflix video player: Story')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit theater mode' })).toBeTruthy();
  });

  it('restores the original link when Sasflix metadata cannot be loaded', async () => {
    getPreview.mockRejectedValue(new Error('preview unavailable'));

    render(<FeedItemCard item={{
      ...item,
      link: 'https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea',
    }} />);

    expect((await screen.findByRole('link', { name: 'Open sasflix.ru' })).getAttribute('href'))
      .toBe('https://sasflix.ru/documentary/630ffde7-febb-4f95-a490-6208d8770dea');
  });
});

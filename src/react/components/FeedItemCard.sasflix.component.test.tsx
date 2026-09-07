// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard Sasflix player', () => {
  const sasflixStorage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => sasflixStorage.clear(),
        getItem: (key: string) => sasflixStorage.get(key) ?? null,
        removeItem: (key: string) => sasflixStorage.delete(key),
        setItem: (key: string, value: string) => sasflixStorage.set(key, value),
      },
    });
  });

  afterEach(() => sasflixStorage.clear());

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
    expect((player as HTMLVideoElement).playbackRate).toBe(2);
    const speedToggle = screen.getByRole('button', { name: 'Playback speed: 2x' });
    expect(speedToggle.textContent).toBe('2x');
    expect(speedToggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(speedToggle);

    expect((player as HTMLVideoElement).playbackRate).toBe(1);
    expect(screen.getByRole('button', { name: 'Playback speed: 1x' }).getAttribute('aria-pressed'))
      .toBe('false');
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

  it('offers to continue from saved Sasflix progress and keeps saving playback', async () => {
    const publicationId = '630ffde7-febb-4f95-a490-6208d8770dea';
    window.localStorage.setItem(`gkfeed.sasflix-progress.v1.${publicationId}`, JSON.stringify({
      position: 108,
      duration: 3600,
      updatedAt: Date.now(),
    }));
    getPreview.mockResolvedValue({
      url: `https://sasflix.ru/documentary/${publicationId}`,
      title: 'Sasflix story',
      description: null,
      image: 'https://sasflix.ru/api/poster/cover?w=1024',
      video: 'https://sasflix.ru/api/video/story.m3u8',
      siteName: 'Сасфликс',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: `https://sasflix.ru/documentary/${publicationId}`,
    }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Play Sasflix video Story' }));

    const player = screen.getByTitle('Sasflix video player: Story') as HTMLVideoElement;
    expect(player.autoplay).toBe(false);
    const play = vi.spyOn(player, 'play').mockResolvedValue();
    const resumeButton = screen.getByRole('button', { name: 'Continue from 1:48' });
    expect(resumeButton.nextElementSibling?.textContent).toBe('2x');

    fireEvent.click(resumeButton);

    expect(player.currentTime).toBe(108);
    expect(play).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Continue from 1:48' })).toBeNull();

    Object.defineProperty(player, 'duration', { configurable: true, value: 3600 });
    player.currentTime = 240;
    fireEvent.timeUpdate(player);
    fireEvent.pause(player);

    expect(JSON.parse(window.localStorage.getItem(
      `gkfeed.sasflix-progress.v1.${publicationId}`,
    ) ?? '{}')).toMatchObject({ position: 240, duration: 3600 });
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

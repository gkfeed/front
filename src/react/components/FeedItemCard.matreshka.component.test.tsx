// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';
import { MatreshkaPreview } from './previews/MatreshkaPreview';

describe('Matreshka player', () => {
  it('shows the video title and channel separately', async () => {
    getPreview.mockResolvedValue({
      url: 'https://matreshka.tv/video/LHAN5jgduhC',
      title: 'Защищаю Братишкина от уставшего дедпи47',
      description: null,
      image: 'https://c4-images.cmtv.ru/video/channel/LHAN5jgduhC/1280x720_preview.png',
      video: null,
      siteName: 'Matreshka',
      type: 'video',
      providerData: null,
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://matreshka.tv/video/LHAN5jgduhC',
      title: 'Видео канала Стас Ай как дорого - Защищаю Братишкина от уставшего дедпи47',
    }} />);

    expect(await screen.findByRole('heading', {
      name: 'Защищаю Братишкина от уставшего дедпи47',
    })).toBeTruthy();
    expect(screen.getByText('Стас Ай как дорого')).toBeTruthy();
    expect(screen.queryByText(/Видео канала/)).toBeNull();
    expect(screen.getByRole('button', {
      name: 'Play Matreshka video Защищаю Братишкина от уставшего дедпи47',
    })).toBeTruthy();
  });

  it('opens the official Matreshka embed in theater mode', () => {
    render(
      <MatreshkaPreview
        videoId="LHAN5jgduhC"
        title="Story"
        videoSrc={null}
        preview={{
          src: 'https://c4-images.cmtv.ru/video/channel/LHAN5jgduhC/1280x720_preview.png',
          alt: 'Matreshka video preview',
        }}
        onPreviewError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play Matreshka video Story' }));

    const player = screen.getByTitle('Matreshka video player: Story');
    expect(player.tagName).toBe('IFRAME');
    expect(player.getAttribute('src'))
      .toBe('https://matreshka.tv/embed/video/LHAN5jgduhC');
    expect(player.getAttribute('allow')).toContain('autoplay');
    expect(document.activeElement).toBe(player);
    expect(screen.getByRole('button', { name: 'Exit theater mode' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('Matreshka video player: Story')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });

  it('does not expose unsupported playback speed controls', () => {
    render(
      <MatreshkaPreview
        videoId="LHAN5jgduhC"
        title="Story"
        videoSrc={null}
        preview={null}
        onPreviewError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Play Matreshka video Story' }));
    expect(screen.queryByRole('button', { name: /Playback speed/ })).toBeNull();
  });

  it('shows a decoded high-quality stream frame over the Open Graph fallback', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    const onPreviewError = vi.fn();
    const fallback = 'https://c4-images.cmtv.ru/video/channel/video/user-cover/1280x720.jpg';
    const { container } = render(
      <MatreshkaPreview
        videoId="video"
        title="Story"
        videoSrc="https://c4-video.cmtv.ru/hm/channel/token/master.m3u8?expires=1&md5=token"
        preview={{ src: fallback, alt: 'Matreshka video preview' }}
        onPreviewError={onPreviewError}
      />,
    );

    const image = screen.getByAltText('Matreshka video preview');
    expect(image.getAttribute('src')).toBe(fallback);
    const video = container.querySelector('video')!;
    expect(video.getAttribute('src')).toContain('/master.m3u8');
    expect(video.classList.contains('reader-card__matreshka-frame--ready')).toBe(false);

    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(2);
    fireEvent.seeked(video);
    expect(video.classList.contains('reader-card__matreshka-frame--ready')).toBe(true);
    expect(onPreviewError).not.toHaveBeenCalled();
  });

  it('keeps the Open Graph image when the high-quality stream fails', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    const { container } = render(
      <MatreshkaPreview
        videoId="video"
        title="Story"
        videoSrc="https://c4-video.cmtv.ru/hm/channel/token/master.m3u8?expires=1&md5=token"
        preview={{
          src: 'https://c4-images.cmtv.ru/video/channel/video/1280x720_preview.png',
          alt: 'Fallback Matreshka cover',
        }}
        onPreviewError={vi.fn()}
      />,
    );

    fireEvent.error(container.querySelector('video')!);
    expect(screen.getByAltText('Fallback Matreshka cover')).toBeTruthy();
    expect(container.querySelector('video')).toBeNull();
  });
});

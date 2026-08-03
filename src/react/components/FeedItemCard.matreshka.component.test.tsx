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
    expect(screen.getByRole('button', { name: 'Exit theater mode' })
      .getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByTitle('Matreshka video player: Story')).toBe(player);
    expect(screen.getByRole('button', { name: 'Enter theater mode' })).toBeTruthy();
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(false);
  });
});

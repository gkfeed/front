// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NsfwPreferencesContext } from '../state/nsfwPreferencesContext';
import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard YouTube and general states', () => {
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
});

// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NsfwPreferencesContext } from '../state/nsfwPreferencesContext';
import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard YouTube and general states', () => {
  const youtubeStorage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => youtubeStorage.get(key) ?? null,
        removeItem: (key: string) => youtubeStorage.delete(key),
        setItem: (key: string, value: string) => youtubeStorage.set(key, value),
      },
    });
  });

  afterEach(() => {
    youtubeStorage.clear();
  });

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
      .toBe('https://www.youtube-nocookie.com/embed/abc123xyz?autoplay=1&rel=0&enablejsapi=1');
    expect(player.getAttribute('allow')).toContain('autoplay');
    expect(screen.queryByAltText('Preview for Story')).toBeNull();
    expect(screen.getByRole('button', { name: 'Playback speed: 2x' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Exit theater mode' }).getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.classList.contains('reader-theater-open')).toBe(true);
  });

  it('offers to continue a YouTube video from its saved position', () => {
    window.localStorage.setItem('gkfeed.youtube-progress.v1.abc123xyz', JSON.stringify({
      position: 108,
      duration: 3600,
      updatedAt: Date.now(),
    }));

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));

    const iframe = screen.getByTitle('Story') as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
    const resumeButton = screen.getByRole('button', { name: 'Continue from 1:48' });
    expect(resumeButton.nextElementSibling?.textContent).toBe('2x');

    fireEvent.click(resumeButton);

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [108, true] }),
      '*',
    );
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      '*',
    );
    expect(screen.queryByRole('button', { name: 'Continue from 1:48' })).toBeNull();
  });

  it('stores YouTube progress when the player pauses', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    const iframe = screen.getByTitle('Story') as HTMLIFrameElement;
    const source = iframe.contentWindow;
    const durationDelivery = new MessageEvent('message', {
      data: JSON.stringify({
        event: 'infoDelivery',
        info: { duration: 3600 },
      }),
      origin: 'https://www.youtube-nocookie.com',
      source,
    });
    const positionDelivery = new MessageEvent('message', {
      data: JSON.stringify({
        event: 'infoDelivery',
        info: { currentTime: 108 },
      }),
      origin: 'https://www.youtube-nocookie.com',
      source,
    });
    const paused = new MessageEvent('message', {
      data: JSON.stringify({ event: 'onStateChange', info: 2 }),
      origin: 'https://www.youtube-nocookie.com',
      source,
    });

    window.dispatchEvent(durationDelivery);
    window.dispatchEvent(positionDelivery);
    window.dispatchEvent(paused);

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 108, duration: 3600 });
  });


  it('toggles YouTube playback speed from the default 2x setting', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    const speedToggle = screen.getByRole('button', { name: 'Playback speed: 2x' });

    fireEvent.click(speedToggle);

    expect(screen.getByRole('button', { name: 'Playback speed: 1x' }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Playback speed: 1x' }));

    expect(screen.getByRole('button', { name: 'Playback speed: 2x' }).getAttribute('aria-pressed')).toBe('true');
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
      providerData: null,
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
      providerData: null,
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

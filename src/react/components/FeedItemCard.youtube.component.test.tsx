// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NsfwPreferencesContext } from '../state/nsfwPreferencesContext';
import type { YoutubePlayer, YoutubePlayerStateChangeEvent } from '../services/youtubeIframeApi';
import { fetchYoutubeComments } from '../services/youtubeComments';
import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

vi.mock('../services/youtubeComments');

describe('FeedItemCard YouTube and general states', () => {
  const youtubeStorage = new Map<string, string>();

  beforeEach(() => {
    vi.mocked(fetchYoutubeComments).mockResolvedValue({ comments: [] });
    youtubeStorage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => youtubeStorage.get(key) ?? null,
        removeItem: (key: string) => youtubeStorage.delete(key),
        setItem: (key: string, value: string) => youtubeStorage.set(key, value),
      },
    });
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    youtubeStorage.clear();
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: undefined,
    });
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

  it('rejects YouTube placeholder images that load successfully', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    const maxResolutionImage = screen.getByAltText('Preview for Story');
    Object.defineProperties(maxResolutionImage, {
      naturalWidth: { configurable: true, value: 120 },
      naturalHeight: { configurable: true, value: 90 },
    });
    fireEvent.load(maxResolutionImage);

    const fallbackImage = screen.getByAltText('Preview for Story');
    expect(fallbackImage.getAttribute('src'))
      .toBe('https://i.ytimg.com/vi/abc123xyz/hqdefault.jpg');
    Object.defineProperties(fallbackImage, {
      naturalWidth: { configurable: true, value: 120 },
      naturalHeight: { configurable: true, value: 90 },
    });
    fireEvent.load(fallbackImage);

    expect(screen.queryByAltText('Preview for Story')).toBeNull();
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

  it('loads YouTube comments on demand from the player toolbar', async () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    expect(fetchYoutubeComments).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Show YouTube comments' }));

    expect(await screen.findByRole('complementary', { name: 'YouTube comments' })).toBeTruthy();
    expect(fetchYoutubeComments).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=abc123xyz',
      expect.any(AbortSignal),
    );
    expect(screen.getByRole('button', { name: 'Hide YouTube comments' }).getAttribute('aria-pressed')).toBe('true');
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

    const speedToggle = screen.getByRole('button', { name: 'Playback speed: 2x' });
    speedToggle.focus();
    fireEvent.keyDown(speedToggle, { key: ' ' });
    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      '*',
    );

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

  it('stores YouTube progress when the player pauses', async () => {
    let stateChangeHandler: (event: YoutubePlayerStateChangeEvent) => void = () => undefined;
    const player: YoutubePlayer = {
      getCurrentTime: () => 108,
      getDuration: () => 3600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: {
            onReady: (event: { target: YoutubePlayer }) => void;
            onStateChange: (event: YoutubePlayerStateChangeEvent) => void;
          };
        }) {
          stateChangeHandler = options.events.onStateChange;
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => stateChangeHandler({ data: 2, target: player }));

    const iframe = screen.getByTitle('Story') as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage');
    const speedToggle = screen.getByRole('button', { name: 'Playback speed: 2x' });
    speedToggle.focus();
    fireEvent.keyDown(speedToggle, { key: ' ' });

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      '*',
    );

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 108, duration: 3600 });
  });

  it('refreshes YouTube progress before saving on pagehide during playback', async () => {
    let currentTime = 108;
    let duration = 3600;
    const getCurrentTime = vi.fn(() => currentTime);
    const player: YoutubePlayer = {
      getCurrentTime,
      getDuration: () => duration,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: { onReady: (event: { target: YoutubePlayer }) => void };
        }) {
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    currentTime = 246;
    duration = 7200;
    window.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 246, duration: 7200 });
    expect(getCurrentTime).toHaveBeenCalledTimes(2);
  });

  it('refreshes YouTube progress before the periodic save during playback', async () => {
    vi.useFakeTimers();
    let currentTime = 108;
    const player: YoutubePlayer = {
      getCurrentTime: () => currentTime,
      getDuration: () => 3600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: { onReady: (event: { target: YoutubePlayer }) => void };
        }) {
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    currentTime = 246;
    act(() => vi.advanceTimersByTime(5000));

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 246, duration: 3600 });
  });

  it('refreshes YouTube progress before saving when the player unmounts during playback', async () => {
    let currentTime = 108;
    const player: YoutubePlayer = {
      getCurrentTime: () => currentTime,
      getDuration: () => 3600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: { onReady: (event: { target: YoutubePlayer }) => void };
        }) {
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    const view = render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    currentTime = 312;
    view.unmount();

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 312, duration: 3600 });
  });

  it('ignores state changes from a YouTube player after it unmounts', async () => {
    let currentTime = 108;
    let stateChangeHandler: (event: YoutubePlayerStateChangeEvent) => void = () => undefined;
    const player: YoutubePlayer = {
      getCurrentTime: () => currentTime,
      getDuration: () => 3600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: {
            onReady: (event: { target: YoutubePlayer }) => void;
            onStateChange: (event: YoutubePlayerStateChangeEvent) => void;
          };
        }) {
          stateChangeHandler = options.events.onStateChange;
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    const view = render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    view.unmount();

    currentTime = 312;
    act(() => stateChangeHandler({ data: 2, target: player }));

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 108, duration: 3600 });
  });

  it('does not overwrite saved progress before the user chooses how to resume', async () => {
    window.localStorage.setItem('gkfeed.youtube-progress.v1.abc123xyz', JSON.stringify({
      position: 108,
      duration: 3600,
      updatedAt: Date.now(),
    }));
    const player: YoutubePlayer = {
      getCurrentTime: () => 0,
      getDuration: () => 3600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: { onReady: (event: { target: YoutubePlayer }) => void };
        }) {
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const iframe = screen.getByTitle('Story') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toContain('autoplay=0');
    window.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(window.localStorage.getItem('gkfeed.youtube-progress.v1.abc123xyz')!))
      .toMatchObject({ position: 108, duration: 3600 });
  });

  it('focuses the video in theater mode so Space controls playback', () => {
    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));

    expect(document.activeElement).toBe(screen.getByTitle('Story'));
    expect(screen.getByRole('button', { name: 'Playback speed: 2x' }).getAttribute('aria-pressed'))
      .toBe('true');
  });

  it('seeks the YouTube video with the left and right arrow keys', async () => {
    const player: YoutubePlayer = {
      getCurrentTime: () => 120,
      getDuration: () => 600,
      setPlaybackRate: vi.fn(),
      seekTo: vi.fn(),
      playVideo: vi.fn(),
      destroy: vi.fn(),
    };
    Object.defineProperty(window, 'YT', {
      configurable: true,
      value: {
        Player: vi.fn(function PlayerConstructor(_iframe: HTMLIFrameElement, options: {
          events: { onReady: (event: { target: YoutubePlayer }) => void };
        }) {
          options.events.onReady({ target: player });
          return player;
        }),
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
    }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Play video Story' }));
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(player.seekTo).toHaveBeenNthCalledWith(1, 115, true);
    expect(player.seekTo).toHaveBeenNthCalledWith(2, 125, true);
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

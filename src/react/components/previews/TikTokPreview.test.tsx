// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTikTokPlayback } from '../../services/tiktokPlayback';
import { TikTokPreview } from './TikTokPreview';

vi.mock('../../services/tiktokPlayback');
const props = {
  href: 'https://www.tiktok.com/@creator/video/123',
  src: 'https://www.tiktok.com/player/v1/123',
  title: 'Test TikTok',
  soundGesture: { isMuted: true, showPrompt: true, enableSound: vi.fn() },
};
const videoUrl = 'https://v.tiktokcdn.com/video.mp4';
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); });
async function getVideo() {
  await waitFor(() => expect(document.querySelector('video')).not.toBeNull());
  return document.querySelector('video')!;
}
function metadata(video: HTMLVideoElement, duration: number) {
  Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  fireEvent.loadedMetadata(video);
}

describe('TikTok preview', () => {
  it('renders photos instead of a black video and supports automatic and manual navigation', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({
      videoUrl, imageUrls: ['https://p.tiktokcdn.com/1.jpeg', 'https://p.tiktokcdn.com/2.jpeg'],
    });
    await act(async () => { render(<TikTokPreview {...props} />); });
    const currentImage = () => document.querySelector('.reader-card__slide')?.getAttribute('src');
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('audio')?.src).toBe(videoUrl);
    expect(currentImage()).toContain('/1.jpeg');
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(currentImage()).toContain('/2.jpeg');
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(currentImage()).toContain('/1.jpeg');
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(currentImage()).toContain('/2.jpeg');
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Pause slideshow' }));
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(currentImage()).toContain('/2.jpeg');
  });

  it('falls back when a slideshow image fails to load', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ imageUrls: ['https://p.tiktokcdn.com/1.jpeg'] });
    render(<TikTokPreview {...props} />);
    await waitFor(() => expect(document.querySelector('.reader-card__slide')).not.toBeNull());
    fireEvent.error(document.querySelector('.reader-card__slide')!);
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('shows author details over the native player and tolerates a broken avatar', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl, author: {
      name: 'АНАСТЕЙДЖИ💋', username: 'anastejj', avatarUrl: 'https://example.com/avatar.jpg',
    } });
    render(<TikTokPreview {...props} />);
    await getVideo();
    expect(screen.getByText('АНАСТЕЙДЖИ💋')).toBeTruthy();
    expect(screen.getByText('anastejj')).toBeTruthy();
    const avatar = document.querySelector('.reader-card__tiktok-author img')!;
    expect(avatar.getAttribute('src')).toBe('https://example.com/avatar.jpg');
    fireEvent.error(avatar);
    expect(document.querySelector('.reader-card__tiktok-author img')).toBeNull();
    expect(document.querySelector('video')).not.toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('automatically doubles the rate when the speed control appears', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    render(<TikTokPreview {...props} />);
    const video = await getVideo();
    expect(video.muted).toBe(true);
    expect(document.querySelector('iframe')).toBeNull();
    for (const duration of [NaN, Infinity, 0, 59, 60]) {
      metadata(video, duration);
      expect(screen.queryByRole('button', { name: 'Double playback speed' })).toBeNull();
    }
    metadata(video, 167.135);
    const button = screen.getByRole('button', { name: 'Double playback speed' });
    expect(video.playbackRate).toBe(2);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(video.playbackRate).toBe(1);
    fireEvent.rateChange(video);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(video.playbackRate).toBe(2);
    fireEvent.rateChange(video);
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to a single embed on media failure', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    render(<TikTokPreview {...props} />);
    const video = await getVideo();
    metadata(video, 167);
    fireEvent.error(video);
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    expect(document.querySelector('iframe')?.src).toBe(props.src);
    expect(screen.queryByRole('button', { name: 'Double playback speed' })).toBeNull();
  });

  it('falls back when the resolver fails', async () => {
    vi.mocked(fetchTikTokPlayback).mockRejectedValue(new Error('Unavailable'));
    render(<TikTokPreview {...props} />);
    await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
    expect(document.querySelector('video')).toBeNull();
  });

  it('falls back if native media never supplies metadata', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    await act(async () => { render(<TikTokPreview {...props} />); });
    expect(document.querySelector('video')).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(document.querySelector('iframe')).not.toBeNull();
  });

  it('aborts old requests and ignores their late results', async () => {
    let resolveFirst!: (value: { videoUrl: string }) => void;
    vi.mocked(fetchTikTokPlayback)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ videoUrl: `${videoUrl}?second` });
    const view = render(<TikTokPreview {...props} />);
    const signal = vi.mocked(fetchTikTokPlayback).mock.calls[0][1];
    view.rerender(<TikTokPreview {...props} href="https://www.tiktok.com/@creator/video/456" />);
    const video = await getVideo();
    await act(async () => { resolveFirst({ videoUrl }); });
    expect(signal.aborted).toBe(true);
    expect(video.src).toBe(`${videoUrl}?second`);
  });

  it('resets speed and duration on a new post', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    const view = render(<TikTokPreview {...props} />);
    const first = await getVideo();
    metadata(first, 167);
    fireEvent.click(screen.getByRole('button', { name: 'Double playback speed' }));
    expect(first.playbackRate).toBe(1);
    view.rerender(<TikTokPreview {...props} href="https://www.tiktok.com/@creator/video/456" />);
    const second = await getVideo();
    expect(second).not.toBe(first);
    expect(second.playbackRate).toBe(1);
    expect(screen.queryByRole('button', { name: 'Double playback speed' })).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BffHttpError } from '../../services/bffClient';
import { fetchTikTokPlayback, getCachedTikTokPlayback } from '../../services/tiktokPlayback';
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
  it('renders a prefetched video on the first render without waiting for an effect', () => {
    vi.mocked(getCachedTikTokPlayback).mockReturnValue({ videoUrl });
    render(<TikTokPreview {...props} />);
    expect(document.querySelector('video')?.getAttribute('src'))
      .toBe(`/bff/tiktok-media?url=${encodeURIComponent(videoUrl)}`);
    expect(fetchTikTokPlayback).not.toHaveBeenCalled();
  });

  it('retries a transient metadata failure while the card remains visible', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockRejectedValueOnce(new BffHttpError('unavailable', 504, '/bff/tiktok-playback'))
      .mockResolvedValueOnce({ videoUrl });
    await act(async () => { render(<TikTokPreview {...props} />); });
    expect(document.querySelector('iframe')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(fetchTikTokPlayback).toHaveBeenCalledTimes(2);
    expect(document.querySelector('video')).not.toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('shows a clear status immediately when TikTok reports a restricted post', async () => {
    vi.mocked(fetchTikTokPlayback).mockRejectedValue(new BffHttpError('not accessible', 422, '/bff/tiktok-playback'));
    render(<TikTokPreview {...props} />);
    await waitFor(() => expect(screen.getByText('This TikTok is unavailable in the preview.')).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Open original' }).getAttribute('href')).toBe(props.href);
    expect(fetchTikTokPlayback).toHaveBeenCalledOnce();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('reports a slow load while allowing a later successful result', async () => {
    vi.useFakeTimers();
    let resolve!: (value: { videoUrl: string }) => void;
    vi.mocked(fetchTikTokPlayback).mockImplementation(() => new Promise((done) => { resolve = done; }));
    await act(async () => { render(<TikTokPreview {...props} />); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByText('Video is taking longer than expected. Still trying to load it.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open original' })).toBeTruthy();
    await act(async () => { resolve({ videoUrl }); });
    expect(document.querySelector('video')).not.toBeNull();
    expect(screen.queryByText('Video is taking longer than expected. Still trying to load it.')).toBeNull();
  });

  it('renders photos instead of a black video and supports automatic and manual navigation', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({
      videoUrl, imageUrls: ['https://p.tiktokcdn.com/1.jpeg', 'https://p.tiktokcdn.com/2.jpeg'],
    });
    await act(async () => { render(<TikTokPreview {...props} />); });
    const currentImage = () => document.querySelector('.reader-card__slide')?.getAttribute('src');
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.querySelector('audio')?.getAttribute('src')).toBe(`/bff/tiktok-media?url=${encodeURIComponent(videoUrl)}`);
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

  it('reports an unavailable slideshow image', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ imageUrls: ['https://p.tiktokcdn.com/1.jpeg'] });
    render(<TikTokPreview {...props} />);
    await waitFor(() => expect(document.querySelector('.reader-card__slide')).not.toBeNull());
    fireEvent.error(document.querySelector('.reader-card__slide')!);
    expect(screen.getByText('This TikTok is unavailable in the preview.')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
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

  it('enables and bypasses audio normalization only on request', async () => {
    const input = { connect: vi.fn(), disconnect: vi.fn() };
    const node = () => ({ connect: vi.fn().mockReturnThis(), threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, gain: { value: 0 } });
    const destination = {};
    const context = { createMediaElementSource: vi.fn(() => input), createDynamicsCompressor: vi.fn(node),
      createGain: vi.fn(node), destination, state: 'running', close: vi.fn().mockResolvedValue(undefined) };
    const AudioContextMock = vi.fn(function () { return context; });
    vi.stubGlobal('AudioContext', AudioContextMock);
    try {
      vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
      render(<TikTokPreview {...props} />);
      await getVideo();
      const button = screen.getByRole('button', { name: 'Normalize audio' });
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(AudioContextMock).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(input.connect).not.toHaveBeenLastCalledWith(destination);
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('false');
      expect(input.connect).toHaveBeenLastCalledWith(destination);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('reports a native video failure immediately', async () => {
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    render(<TikTokPreview {...props} />);
    const video = await getVideo();
    metadata(video, 167);
    fireEvent.error(video);
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByText('This TikTok is unavailable in the preview.')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Double playback speed' })).toBeNull();
  });

  it('shows an unavailable message when the resolver fails', async () => {
    vi.mocked(fetchTikTokPlayback).mockRejectedValue(new Error('Unavailable'));
    render(<TikTokPreview {...props} />);
    await waitFor(() => expect(screen.getByText('This TikTok is unavailable in the preview.')).toBeTruthy());
    expect(document.querySelector('video')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('reports slow media while letting the video continue loading', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    await act(async () => { render(<TikTokPreview {...props} />); });
    const video = document.querySelector('video')!;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByText('Video is taking longer than expected. Still trying to load it.')).toBeTruthy();
    fireEvent.loadedData(video);
    expect(screen.queryByText('Video is taking longer than expected. Still trying to load it.')).toBeNull();
    expect(document.querySelector('video')).not.toBeNull();
  });

  it('reports a video that never supplies metadata', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchTikTokPlayback).mockResolvedValue({ videoUrl });
    await act(async () => { render(<TikTokPreview {...props} />); });
    expect(document.querySelector('video')).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(screen.getByText('This TikTok is unavailable in the preview.')).toBeTruthy();
    expect(document.querySelector('iframe')).toBeNull();
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
    expect(video.getAttribute('src')).toBe(`/bff/tiktok-media?url=${encodeURIComponent(`${videoUrl}?second`)}`);
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

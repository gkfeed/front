// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedItemVideoMedia } from './FeedItemVideoMedia';

afterEach(cleanup);

function CachedVideo({ src, duration, width, height }: { src: string; duration: number; width: number; height: number }) {
  useLayoutEffect(() => {
    const video = screen.getByLabelText('Cached video');
    Object.defineProperties(video, {
      duration: { configurable: true, value: duration },
      videoWidth: { configurable: true, value: width },
      videoHeight: { configurable: true, value: height },
    });
    video.dispatchEvent(new Event('loadedmetadata', { bubbles: true }));
  }, [duration, height, src, width]);
  return <FeedItemVideoMedia preview={{ type: 'video', src, alt: 'Cached video' }} isShortVideo isTikTok onPreviewError={vi.fn()} />;
}

describe('video metadata lifecycle', () => {
  it('retains metadata that arrives before passive effects on mount and source changes', async () => {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<CachedVideo src="https://example.com/first.mp4" duration={167} width={720} height={1280} />);
    });
    const first = screen.getByLabelText('Cached video') as HTMLVideoElement;
    expect(first.closest('.reader-card__preview')?.getAttribute('style')).toContain('aspect-ratio: 0.5625');
    expect(screen.getByRole('button', { name: 'Double playback speed' }).getAttribute('aria-pressed')).toBe('true');
    expect(first.playbackRate).toBe(2);

    await act(async () => {
      view.rerender(<CachedVideo src="https://example.com/second.mp4" duration={30} width={1920} height={1080} />);
    });
    const second = screen.getByLabelText('Cached video') as HTMLVideoElement;
    expect(second).not.toBe(first);
    expect(second.closest('.reader-card__preview')?.getAttribute('style')).toContain('aspect-ratio: 1.7777777777777777');
    expect(screen.queryByRole('button', { name: 'Double playback speed' })).toBeNull();
    expect(second.playbackRate).toBe(1);
  });
});

// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FeedItemVideoMedia } from './FeedItemVideoMedia';

describe('story video loading', () => {
  it('reveals the first decoded frame without resizing on metadata or flashing during buffering', () => {
    const props = {
      preview: { type: 'video' as const, src: 'https://example.com/one.mp4', alt: 'Story' },
      isShortVideo: true, isTikTok: false, onPreviewError: vi.fn(),
    };
    const { container, rerender } = render(<FeedItemVideoMedia {...props} />);
    const frame = container.firstElementChild as HTMLElement;
    const video = container.querySelector('video')!;
    expect(frame.dataset.mediaReady).toBe('false');
    Object.defineProperties(video, {
      videoWidth: { value: 1080 }, videoHeight: { value: 1920 },
    });
    fireEvent.loadedMetadata(video);
    expect(frame.style.aspectRatio).toBe('');
    expect(frame.classList.contains('reader-card__preview--video-adaptive')).toBe(false);
    expect(frame.dataset.mediaReady).toBe('false');
    fireEvent.loadedData(video);
    expect(frame.dataset.mediaReady).toBe('true');
    fireEvent.waiting(video);
    expect(frame.dataset.mediaReady).toBe('true');
    rerender(<FeedItemVideoMedia {...props} preview={{ ...props.preview, src: 'https://example.com/two.mp4' }} />);
    expect(frame.dataset.mediaReady).toBe('false');
  });
});

// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedItemVideoMedia } from './FeedItemVideoMedia';
import { useHlsVideo } from './useHlsVideo';

vi.mock('./useHlsVideo');
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Feed item HLS video playback', () => {
  it('attaches the HLS player for a Reddit stream and reports fatal errors', () => {
    const onPreviewError = vi.fn();
    const src = 'https://v.redd.it/tma4eya482sh1/HLSPlaylist.m3u8?a=token&v=1';
    render(<FeedItemVideoMedia
      preview={{ type: 'video', src, alt: 'Reddit video', poster: 'https://example.com/poster.jpg' }}
      isShortVideo={false} isTikTok={false} onPreviewError={onPreviewError}
    />);

    const video = screen.getByLabelText('Reddit video');
    expect(video.getAttribute('src')).toBeNull();
    expect(video.getAttribute('poster')).toBe('https://example.com/poster.jpg');
    const playback = vi.mocked(useHlsVideo).mock.calls.at(-1)?.[0];
    expect(playback?.enabled).toBe(true);
    expect(playback?.src).toBe(src);
    expect(playback?.videoRef.current).toBe(video);
    act(() => playback?.onFatalError?.());
    expect(onPreviewError).toHaveBeenCalledOnce();
  });

  it('keeps native MP4 playback without activating HLS', () => {
    const src = 'https://example.com/video.mp4';
    render(<FeedItemVideoMedia
      preview={{ type: 'video', src, alt: 'MP4 video' }}
      isShortVideo={false} isTikTok={false} onPreviewError={vi.fn()}
    />);
    expect(screen.getByLabelText('MP4 video').getAttribute('src')).toBe(src);
    expect(vi.mocked(useHlsVideo).mock.calls.at(-1)?.[0].enabled).toBe(false);
  });
});

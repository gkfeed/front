// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const player = vi.hoisted(() => ({
  supported: vi.fn(() => true),
  loadSource: vi.fn(), attachMedia: vi.fn(), on: vi.fn(), destroy: vi.fn(),
}));
vi.mock('hls.js', () => ({
  default: class {
    static isSupported = player.supported;
    static Events = { ERROR: 'error' };
    loadSource = player.loadSource;
    attachMedia = player.attachMedia;
    on = player.on;
    destroy = player.destroy;
  },
}));

import { useHlsVideo } from './useHlsVideo';

const src = 'https://v.redd.it/abc123/HLSPlaylist.m3u8';
function Player({ enabled = true }: { enabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useHlsVideo({ src, videoRef, enabled });
  return <video ref={videoRef} />;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe('HLS playback selection', () => {
  it('uses HLS.js even when the browser reports native HLS support', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    player.supported.mockReturnValue(true);
    const { container, unmount } = render(<Player />);
    await waitFor(() => expect(player.attachMedia).toHaveBeenCalledWith(container.querySelector('video')));
    expect(player.loadSource).toHaveBeenCalledWith(src);
    expect(container.querySelector('video')?.getAttribute('src')).toBeNull();
    unmount();
    expect(player.destroy).toHaveBeenCalledOnce();
  });

  it('uses native HLS on browsers without MediaSource support', async () => {
    player.supported.mockReturnValue(false);
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe');
    const { container } = render(<Player />);
    await waitFor(() => expect(container.querySelector('video')?.getAttribute('src')).toBe(src));
    expect(player.attachMedia).not.toHaveBeenCalled();
  });

  it('does not attach or clear a native video source when disabled', () => {
    const { container, unmount } = render(<Player enabled={false} />);
    const video = container.querySelector('video')!;
    video.src = 'https://example.com/video.mp4';
    unmount();
    expect(video.getAttribute('src')).toBe('https://example.com/video.mp4');
    expect(player.attachMedia).not.toHaveBeenCalled();
  });
});

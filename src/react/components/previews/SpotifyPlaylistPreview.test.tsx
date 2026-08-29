// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadSpotifyIframeApi,
  type SpotifyIframeApi,
} from '../../services/spotifyIframeApi';
import { SpotifyPlaylistPreview } from './SpotifyPlaylistPreview';

vi.mock('../../services/spotifyIframeApi', () => ({
  loadSpotifyIframeApi: vi.fn(),
}));

const mockedLoadSpotifyIframeApi = vi.mocked(loadSpotifyIframeApi);
const props = {
  embedUrl: 'https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl',
  embedHeight: 152 as const,
  spotifyUrl: 'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
  imageSrc: 'https://example.com/cover.jpg',
  imageAlt: 'Cover',
  title: 'Example track',
  onPreviewError: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe('SpotifyPlaylistPreview', () => {
  it('starts playback through the Spotify IFrame API on desktop', async () => {
    const play = vi.fn();
    const destroy = vi.fn();
    const createController = vi.fn<SpotifyIframeApi['createController']>((_element, _options, callback) => {
      callback({ play, destroy });
    });
    mockedLoadSpotifyIframeApi.mockResolvedValue({ createController });

    render(<SpotifyPlaylistPreview {...props} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(createController).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      {
        url: props.spotifyUrl,
        width: '100%',
        height: props.embedHeight,
      },
      expect.any(Function),
    );
    expect(screen.getByTitle('Spotify player: Example track').hasAttribute('hidden')).toBe(true);
  });

  it('keeps the ordinary player on Apple mobile devices', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });

    render(<SpotifyPlaylistPreview {...props} />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockedLoadSpotifyIframeApi).not.toHaveBeenCalled();
    expect(screen.getByTitle('Spotify player: Example track').hasAttribute('hidden')).toBe(false);
  });
});

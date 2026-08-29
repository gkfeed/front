import { describe, expect, it } from 'vitest';

import { getSpotifyEmbed } from './spotifyPreview';

describe('getSpotifyEmbed', () => {
  it('creates an embed URL for a Spotify playlist', () => {
    expect(getSpotifyEmbed(
      'https://open.spotify.com/playlist/37i9dQZEVXbeUwP0nygk6B?si=example',
    )).toEqual({
      url: 'https://open.spotify.com/embed/playlist/37i9dQZEVXbeUwP0nygk6B',
      height: 352,
      type: 'playlist',
    });
  });

  it('accepts localized Spotify URLs', () => {
    expect(getSpotifyEmbed(
      'https://open.spotify.com/intl-de/playlist/37i9dQZEVXbeUwP0nygk6B',
    )?.url).toBe('https://open.spotify.com/embed/playlist/37i9dQZEVXbeUwP0nygk6B');
  });

  it('creates a large embed for an album', () => {
    expect(getSpotifyEmbed(
      'https://open.spotify.com/album/5n9oHQlYB2XRQZqFrJILxx',
    )).toEqual({
      url: 'https://open.spotify.com/embed/album/5n9oHQlYB2XRQZqFrJILxx',
      height: 352,
      type: 'album',
    });
  });

  it('creates a compact embed for a track', () => {
    expect(getSpotifyEmbed(
      'https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl',
    )).toEqual({
      url: 'https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl',
      height: 152,
      type: 'track',
    });
  });

  it.each([
    'https://spotify.example.com/playlist/37i9dQZEVXbeUwP0nygk6B',
    'http://open.spotify.com/playlist/37i9dQZEVXbeUwP0nygk6B',
    'https://open.spotify.com/playlist/not-an-id',
  ])('rejects unsupported URLs: %s', (url) => {
    expect(getSpotifyEmbed(url)).toBeNull();
  });
});

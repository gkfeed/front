// @vitest-environment jsdom

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const SCRIPT_SELECTOR = 'script[src="https://open.spotify.com/embed/iframe-api/v1"]';

beforeEach(() => vi.resetModules());

afterEach(() => {
  document.querySelector(SCRIPT_SELECTOR)?.remove();
  delete window.onSpotifyIframeApiReady;
});

it('rejects script failures without leaving an unhandled rejection', async () => {
  const { loadSpotifyIframeApi } = await import('./spotifyIframeApi');
  const pending = loadSpotifyIframeApi();
  const failure = expect(pending).rejects.toThrow('Failed to load Spotify IFrame API');

  document.querySelector(SCRIPT_SELECTOR)!.dispatchEvent(new Event('error'));
  await failure;
  // Let unhandled rejections reach Vitest before the test finishes.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

it('shares pending loads and caches the API after it initializes', async () => {
  const { loadSpotifyIframeApi } = await import('./spotifyIframeApi');
  const pending = loadSpotifyIframeApi();
  expect(loadSpotifyIframeApi()).toBe(pending);
  expect(document.querySelectorAll(SCRIPT_SELECTOR)).toHaveLength(1);

  const api = { createController: vi.fn() };
  window.onSpotifyIframeApiReady!(api);

  await expect(pending).resolves.toBe(api);
  await expect(loadSpotifyIframeApi()).resolves.toBe(api);
});

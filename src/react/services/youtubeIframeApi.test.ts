// @vitest-environment jsdom

import { afterEach, expect, it } from 'vitest';

import { loadYoutubeIframeApi } from './youtubeIframeApi';

const SCRIPT_SELECTOR = 'script[src="https://www.youtube.com/iframe_api"]';

afterEach(() => {
  document.querySelector(SCRIPT_SELECTOR)?.remove();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
});

it('retries loading the YouTube API after a script error', async () => {
  const first = loadYoutubeIframeApi();
  const failedScript = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  expect(failedScript).not.toBeNull();

  const failure = expect(first).rejects.toThrow('Failed to load YouTube IFrame API');
  failedScript!.dispatchEvent(new Event('error'));
  await failure;

  const second = loadYoutubeIframeApi();
  const retryScript = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);
  expect(second).not.toBe(first);
  expect(retryScript).not.toBeNull();
  expect(retryScript).not.toBe(failedScript);

  const api = { Player: class {} } as unknown as NonNullable<Window['YT']>;
  window.YT = api;
  window.onYouTubeIframeAPIReady?.();
  await expect(second).resolves.toBe(api);
});

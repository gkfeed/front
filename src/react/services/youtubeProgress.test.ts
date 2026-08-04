// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readYoutubeProgress, writeYoutubeProgress } from './youtubeProgress';

describe('YouTube progress storage', () => {
  const youtubeStorage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => youtubeStorage.get(key) ?? null,
        removeItem: (key: string) => youtubeStorage.delete(key),
        setItem: (key: string, value: string) => youtubeStorage.set(key, value),
      },
    });
  });

  afterEach(() => youtubeStorage.clear());

  it('does not let a less advanced player overwrite saved progress', () => {
    writeYoutubeProgress('abc123xyz', 240, 3600);
    writeYoutubeProgress('abc123xyz', 120, 3600);

    expect(readYoutubeProgress('abc123xyz')).toMatchObject({
      position: 240,
      duration: 3600,
    });
  });
});

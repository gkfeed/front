// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSasflixProgress, writeSasflixProgress } from './sasflixProgress';
import { readYoutubeProgress, writeYoutubeProgress } from './youtubeProgress';

describe('media progress storage', () => {
  const mediaStorage = new Map<string, string>();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => mediaStorage.get(key) ?? null,
        removeItem: (key: string) => mediaStorage.delete(key),
        setItem: (key: string, value: string) => mediaStorage.set(key, value),
      },
    });
  });

  afterEach(() => mediaStorage.clear());

  it('saves a backward seek for YouTube', () => {
    writeYoutubeProgress('abc123xyz', 240, 3600);
    writeYoutubeProgress('abc123xyz', 120, 3600);

    expect(readYoutubeProgress('abc123xyz')).toMatchObject({
      position: 120,
      duration: 3600,
    });
  });

  it('saves a backward seek for Sasflix', () => {
    writeSasflixProgress('publication-id', 240, 3600);
    writeSasflixProgress('publication-id', 120, 3600);

    expect(readSasflixProgress('publication-id')).toMatchObject({
      position: 120,
      duration: 3600,
    });
  });
});

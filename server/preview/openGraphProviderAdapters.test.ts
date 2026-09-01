import { describe, expect, it } from 'vitest';

import { findOpenGraphProviderAdapter, openGraphProviderAdapters } from './openGraphProviderAdapters.js';

describe('Open Graph provider adapters', () => {
  it('keeps the seven provider behaviors behind one adapter seam', () => {
    expect(openGraphProviderAdapters).toHaveLength(7);

    for (const value of [
      'https://www.hltv.org/matches/123/team-a-vs-team-b',
      'https://onefootball.com/en/match/2700208',
      'https://hdrezka.me/films/drama/123-story.html',
      'https://www.instagram.com/reel/ABC123/',
      'https://matreshka.tv/video/channel/',
      'https://sasflix.ru/topic/630ffde7-febb-4f95-a490-6208d8770dea',
      'https://vk.ru/wall-1_2',
    ]) {
      expect(findOpenGraphProviderAdapter(new URL(value)), value).toBeDefined();
    }
  });

  it('leaves ordinary pages to the generic preview module', () => {
    expect(findOpenGraphProviderAdapter(new URL('https://example.com/posts/1'))).toBeUndefined();
  });
});

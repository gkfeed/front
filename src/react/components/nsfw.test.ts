import { describe, expect, it } from 'vitest';

import { isNsfwLink } from '../domain/nsfw';

describe('isNsfwLink', () => {
  it('recognizes Porno365 and Pornhub hostnames', () => {
    expect(isNsfwLink('https://porno365.example/video/1')).toBe(true);
    expect(isNsfwLink('https://www.pornhub.com/view_video.php?viewkey=1')).toBe(true);
    expect(isNsfwLink('https://rt.pornhub.org/video/1')).toBe(true);
  });

  it('does not match partial or invalid hostnames', () => {
    expect(isNsfwLink('https://notpornhub.com/story')).toBe(false);
    expect(isNsfwLink('https://example.com/pornhub/video')).toBe(false);
    expect(isNsfwLink('not a url')).toBe(false);
  });
});

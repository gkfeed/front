import { describe, expect, it } from 'vitest';

import { isTikTokCommentsPreview, isTikTokPlaybackPreview } from './tiktokContracts';

describe('TikTok comments contract', () => {
  it('accepts the canonical BFF response shape', () => {
    expect(isTikTokCommentsPreview({
      comments: [{
        id: 'comment-1',
        text: 'Hello',
        author: 'Mira',
        username: 'mira',
        avatarUrl: null,
      }],
      description: 'A video caption',
      creatorName: 'Mira',
      creatorAvatarUrl: 'https://example.com/avatar.jpg',
    })).toBe(true);
  });

  it('rejects the old divergent fixture shape', () => {
    expect(isTikTokCommentsPreview({
      comments: [],
      description: null,
      authorName: null,
      authorAvatar: null,
    })).toBe(false);
  });
});

describe('TikTok slideshow contract', () => {
  it('accepts photos with an optional soundtrack', () => {
    const imageUrls = ['https://p.tiktokcdn.com/1.jpeg'];
    expect(isTikTokPlaybackPreview({ imageUrls })).toBe(true);
    expect(isTikTokPlaybackPreview({ imageUrls, videoUrl: 'https://v.tikwm.com/music.mp3' })).toBe(true);
  });

  it.each([{ imageUrls: [] }, { imageUrls: ['javascript:alert(1)'] }, { imageUrls: [null] }])('rejects invalid image lists: %j', ({ imageUrls }) => {
    expect(isTikTokPlaybackPreview({ imageUrls })).toBe(false);
  });
});

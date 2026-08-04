import { describe, expect, it } from 'vitest';

import { isTikTokCommentsPreview } from './tiktokContracts';

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

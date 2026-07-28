import { describe, expect, it } from 'vitest';

import { parseTikTokComments } from './tiktok.js';

describe('parseTikTokComments', () => {
  it('maps multiple comments with names, usernames, and avatars', () => {
    expect(parseTikTokComments({
      code: 0,
      data: {
        comments: [
          {
            id: '1',
            text: 'First comment',
            user: {
              nickname: 'Mira',
              unique_id: 'mira_user',
              avatar: 'https://cdn.example.com/mira.jpg',
            },
          },
          {
            id: '2',
            text: 'Second comment',
            user: { nickname: 'Leo', unique_id: 'leo_user', avatar: 'javascript:bad' },
          },
        ],
      },
    })).toEqual([
      {
        id: '1',
        text: 'First comment',
        author: 'Mira',
        username: 'mira_user',
        avatarUrl: 'https://cdn.example.com/mira.jpg',
      },
      {
        id: '2',
        text: 'Second comment',
        author: 'Leo',
        username: 'leo_user',
        avatarUrl: null,
      },
    ]);
  });
});

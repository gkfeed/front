import { describe, expect, it } from 'vitest';

import { parseTikTokComments, parseTikTokDescription, parseTikTokDetails } from './tiktok.js';

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

describe('parseTikTokDescription', () => {
  it('reads and normalizes the caption from TikTok oEmbed data', () => {
    expect(parseTikTokDescription({
      title: 'A video caption\nwith spacing #one #два',
    })).toBe('A video caption with spacing #one #два');
  });

  it('returns null when the caption is unavailable', () => {
    expect(parseTikTokDescription({ title: '' })).toBeNull();
    expect(parseTikTokDescription({})).toBeNull();
  });
});

describe('parseTikTokDetails', () => {
  it('maps the video caption and creator identity', () => {
    expect(parseTikTokDetails({
      code: 0,
      data: {
        title: 'Creator caption #video',
        author: {
          nickname: 'Video Creator',
          avatar: 'https://cdn.example.com/creator.jpg',
        },
      },
    })).toEqual({
      description: 'Creator caption #video',
      creatorName: 'Video Creator',
      creatorAvatarUrl: 'https://cdn.example.com/creator.jpg',
    });
  });
});

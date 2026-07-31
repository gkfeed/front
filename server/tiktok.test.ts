import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('./publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./publicHttp.js')>(),
  requestPublicHttp,
}));

import { PublicHttpError } from './publicHttp.js';
import {
  fetchTikTokComments,
  parseTikTokComments,
  parseTikTokDescription,
  parseTikTokDetails,
} from './tiktok.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
});

describe('fetchTikTokComments', () => {
  it('maps a non-success comments response to an upstream error', async () => {
    requestPublicHttp.mockImplementation(async () => jsonResponse('{}', 503));

    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ code: 'comments_upstream_error', status: 502 });
  });

  it('preserves invalid JSON and response-size errors from the comments provider', async () => {
    requestPublicHttp.mockImplementation(async () => jsonResponse('not-json'));

    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ code: 'invalid_comments', status: 502 });
  });

  it('maps a provider timeout to a fetch error', async () => {
    requestPublicHttp.mockRejectedValue(new PublicHttpError('timeout'));

    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ code: 'comments_fetch_failed', status: 502 });
  });
});

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
    expect(parseTikTokDescription({ title: '\uFFFD' })).toBeNull();
    expect(parseTikTokDescription({})).toBeNull();
  });

  it('preserves valid emoji while removing replacement markers', () => {
    expect(parseTikTokDescription({ title: '\uFFFD 🎉' })).toBe('🎉');
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

function jsonResponse(body: string, status = 200) {
  return {
    body: Readable.from([body]),
    headers: {},
    status,
    url: new URL('https://provider.example/'),
  };
}

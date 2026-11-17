import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestPublicHttp = vi.hoisted(() => vi.fn());

vi.mock('./tiktokWebComments.js', () => ({
  fetchTikTokWebComments: vi.fn().mockResolvedValue(null),
  fetchTikTokWebDetails: vi.fn().mockResolvedValue(null),
}));

vi.mock('./publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./publicHttp.js')>(),
  requestPublicHttp,
}));

import { PublicHttpError } from './publicHttp.js';
import { PreviewError } from './preview/errors.js';
import { fetchTikTokWebComments, fetchTikTokWebDetails } from './tiktokWebComments.js';
import {
  fetchTikTokComments,
  parseTikTokComments,
  parseTikTokDescription,
  parseTikTokDetails,
} from './tiktok.js';
import { parseTikTokVideoUrl } from './tiktokParser.js';

beforeEach(() => {
  requestPublicHttp.mockReset();
  vi.mocked(fetchTikTokWebComments).mockReset().mockResolvedValue(null);
  vi.mocked(fetchTikTokWebDetails).mockReset().mockResolvedValue(null);
});

describe('fetchTikTokComments', () => {
  it('returns direct TikTok comments without contacting the fallback provider', async () => {
    const comments = [{ id: '1', text: 'Hello', author: 'Viewer', username: 'viewer', avatarUrl: null }];
    const details = { description: 'Caption', creatorName: 'Creator', creatorAvatarUrl: null };
    vi.mocked(fetchTikTokWebComments).mockResolvedValueOnce(comments);
    vi.mocked(fetchTikTokWebDetails).mockResolvedValueOnce(details);
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .resolves.toEqual({ comments, ...details });
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('retries a temporary direct comments failure once', async () => {
    vi.mocked(fetchTikTokWebComments).mockRejectedValueOnce(new PublicHttpError('network')).mockResolvedValueOnce([]);
    vi.mocked(fetchTikTokWebDetails).mockResolvedValueOnce({ description: 'Video caption', creatorName: 'Creator', creatorAvatarUrl: null });
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .resolves.toMatchObject({ comments: [], description: 'Video caption' });
    expect(fetchTikTokWebComments).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('stops after two unsuccessful direct responses without contacting TikWM', async () => {
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ kind: 'comments_upstream_error' });
    expect(fetchTikTokWebComments).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('preserves invalid JSON and response-size errors from TikTok', async () => {
    vi.mocked(fetchTikTokWebComments).mockRejectedValueOnce(new PreviewError('invalid JSON', 'invalid_comments'));
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ kind: 'invalid_comments' });
    expect(fetchTikTokWebComments).toHaveBeenCalledOnce();
  });

  it('does not retry a request aborted by the client', async () => {
    vi.mocked(fetchTikTokWebComments).mockRejectedValueOnce(new PublicHttpError('aborted'));
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ kind: 'comments_fetch_failed' });
    expect(fetchTikTokWebComments).toHaveBeenCalledOnce();
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('maps repeated direct timeouts to a fetch error', async () => {
    vi.mocked(fetchTikTokWebComments).mockRejectedValue(new PublicHttpError('timeout'));
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .rejects.toMatchObject({ kind: 'comments_fetch_failed' });
    expect(fetchTikTokWebComments).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });

  it('preserves comments if the direct creator details request fails', async () => {
    vi.mocked(fetchTikTokWebComments).mockResolvedValueOnce([]);
    vi.mocked(fetchTikTokWebDetails).mockRejectedValueOnce(new PublicHttpError('network'));
    await expect(fetchTikTokComments('https://www.tiktok.com/@creator/video/123'))
      .resolves.toEqual({ comments: [], description: null, creatorName: null, creatorAvatarUrl: null });
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });
});

describe('parseTikTokVideoUrl', () => {
  it.each([
    ['https://www.tiktok.com/@creator/video/123', '/@creator/video/123'],
    ['https://m.tiktok.com/v/123', '/v/123'],
  ])('accepts shared TikTok video path %s', (value, pathname) => {
    expect(parseTikTokVideoUrl(value).pathname).toBe(pathname);
  });

  it.each([
    'https://tiktok.com.example.org/video/123',
    'https://tiktok.com/video/123abc',
  ])('rejects lookalike or malformed TikTok URL %s', (value) => {
    expect(() => parseTikTokVideoUrl(value)).toThrowError('A valid TikTok video URL is required');
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

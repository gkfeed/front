import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPublicHttp } from './publicHttp.js';
import { fetchTikTokWebComments, fetchTikTokWebDetails } from './tiktokWebComments.js';

vi.mock('./publicHttp.js', async (original) => ({
  ...await original<typeof import('./publicHttp.js')>(), requestPublicHttp: vi.fn(),
}));
const post = new URL('https://www.tiktok.com/@creator/video/123');
function response(body: string) {
  return { body: Readable.from([body]) as never, status: 200, headers: {}, url: post };
}
afterEach(() => vi.resetAllMocks());

describe('TikTok web comments', () => {
  it('normalizes the official response and validates avatar URLs', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(JSON.stringify({ status_code: 0, comments: [
      { cid: '42', text: ' Hello  world ', user: { nickname: 'Creator', unique_id: 'creator',
        avatar_thumb: { url_list: ['javascript:bad', 'https://p.tiktokcdn.com/avatar'] } } },
      { cid: '43', text: ' ', user: {} },
    ] })));
    await expect(fetchTikTokWebComments(post)).resolves.toEqual([{
      id: '42', text: 'Hello world', author: 'Creator', username: 'creator', avatarUrl: 'https://p.tiktokcdn.com/avatar',
    }]);
    const url = vi.mocked(requestPublicHttp).mock.calls[0]![0];
    expect(url.hostname).toBe('www.tiktok.com');
    expect(url.searchParams.get('aweme_id')).toBe('123');
  });

  it('distinguishes an empty list from an unsuccessful response', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(JSON.stringify({ status_code: 0, comments: null, total: 0 })))
      .mockResolvedValueOnce(response(JSON.stringify({ status_code: 1, comments: null })));
    await expect(fetchTikTokWebComments(post)).resolves.toEqual([]);
    await expect(fetchTikTokWebComments(post)).resolves.toBeNull();
  });

  it('reads the matching author and description from the public page', async () => {
    const state = { __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: {
      id: '123', desc: ' Caption ', author: { nickname: 'Author', avatarThumb: 'https://p.tiktokcdn.com/avatar' },
    } } } } };
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">${JSON.stringify(state)}</script>`));
    await expect(fetchTikTokWebDetails(post)).resolves.toEqual({
      description: 'Caption', creatorName: 'Author', creatorAvatarUrl: 'https://p.tiktokcdn.com/avatar',
    });
  });
});

import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestPublicHttp } from './publicHttp.js';
import { scheduleTikwmRequest } from './tikwmRequestScheduler.js';
import { fetchTikTokJson } from './tiktokJson.js';

vi.mock('./publicHttp.js', async (original) => ({
  ...await original<typeof import('./publicHttp.js')>(), requestPublicHttp: vi.fn(),
}));
vi.mock('./tikwmRequestScheduler.js', () => ({ scheduleTikwmRequest: vi.fn().mockResolvedValue(undefined) }));
afterEach(() => vi.clearAllMocks());
const url = new URL('https://www.tikwm.com/api/?url=https://www.tiktok.com/@creator/video/123');
function response(value: unknown, status = 200) {
  const body = new IncomingMessage(new Socket());
  body.push(JSON.stringify(value));
  body.push(null);
  return { body, headers: {}, status, url };
}

describe('TikTok JSON provider requests', () => {
  it.each([200, 429])('retries a rate limit response at HTTP %s after scheduling another slot', async (status) => {
    const value = { code: 0, data: { play: 'https://v.tiktokcdn.com/video.mp4' } };
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response({ code: -1, msg: 'Free Api Limit: 1 request/second.' }, status))
      .mockResolvedValueOnce(response(value));
    await expect(fetchTikTokJson(url, 'details')).resolves.toEqual({ value });
    expect(scheduleTikwmRequest).toHaveBeenCalledTimes(2);
    expect(requestPublicHttp).toHaveBeenCalledTimes(2);
  });

  it('does not retry unavailable posts or repeatedly throttled requests', async () => {
    const unavailable = { code: -1, msg: 'Video not found' };
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(unavailable));
    await expect(fetchTikTokJson(url, 'details')).resolves.toEqual({ value: unavailable });
    expect(requestPublicHttp).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    const limited = { code: -1, msg: 'Free Api Limit: 1 request/second.' };
    vi.mocked(requestPublicHttp).mockImplementation(async () => response(limited));
    await expect(fetchTikTokJson(url, 'details')).resolves.toEqual({ value: limited });
    expect(requestPublicHttp).toHaveBeenCalledTimes(2);
  });

  it('keeps official oEmbed independent of the TikWM queue', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response({ title: 'Post' }));
    await fetchTikTokJson(new URL('https://www.tiktok.com/oembed'), 'oembed');
    expect(scheduleTikwmRequest).not.toHaveBeenCalled();
  });
});

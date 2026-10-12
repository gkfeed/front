import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { expect, it, vi } from 'vitest';
import { requestPublicHttp } from './publicHttp.js';
import { fetchTikTokPlayback } from './tiktokPlayback.js';
import { fetchTikTokComments } from './tiktokComments.js';

vi.mock('./publicHttp.js', async (original) => ({
  ...await original<typeof import('./publicHttp.js')>(), requestPublicHttp: vi.fn(),
}));

it('resolves Preview while comments load against the provider one-request-per-second limit', async () => {
  const starts: number[] = [];
  let lastStart = 0;
  vi.mocked(requestPublicHttp).mockImplementation(async (url) => {
    const now = Date.now();
    const throttled = now - lastStart < 1000;
    lastStart = now;
    starts.push(now);
    const value = throttled
      ? { code: -1, msg: 'Free Api Limit: 1 request/second.' }
      : { code: 0, data: url.pathname === '/api/comment/list'
        ? { comments: [] }
        : { play: 'https://v.tiktokcdn.com/video.mp4', title: 'corpse bride cosplay' } };
    const body = new IncomingMessage(new Socket());
    body.push(JSON.stringify(value));
    body.push(null);
    return { body, headers: {}, status: 200, url };
  });
  const post = 'https://www.tiktok.com/@tanyaasmr/video/7695397438609198354';
  const [playback, comments] = await Promise.all([fetchTikTokPlayback(post), fetchTikTokComments(post)]);
  expect(playback.videoUrl).toBe('https://v.tiktokcdn.com/video.mp4');
  expect(comments).toMatchObject({ description: 'corpse bride cosplay', comments: [] });
  expect(starts).toHaveLength(3);
  expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
  expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(1000);
});

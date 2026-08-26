import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDetachedRequestExecutionContext } from './application/requestExecutionContext.js';
import { requestPublicHttp } from './publicHttp.js';
import { fetchTikTokVideo } from './tiktokVideo.js';

vi.mock('./publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./publicHttp.js')>(),
  requestPublicHttp: vi.fn(),
}));

const request = vi.mocked(requestPublicHttp);

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('TikTok broker download', () => {
  it('enqueues a download, reads its result, and returns the public media URL', async () => {
    vi.stubEnv('TIKTOK_BROKER_URL', 'https://broker.example.com');
    request
      .mockResolvedValueOnce(jsonResponse('https://broker.example.com/enqueue', {
        task_id: 'task-123',
        status: 'pending',
      }))
      .mockResolvedValueOnce(jsonResponse('https://broker.example.com/result/task-123', {
        task_id: 'task-123',
        status: 'completed',
        result: 'https://files.example.com/video.mp4',
      }));

    await expect(fetchTikTokVideo(
      'https://www.tiktok.com/@creator/video/123',
      createDetachedRequestExecutionContext(),
    )).resolves.toEqual({ url: 'https://files.example.com/video.mp4' });

    expect(request).toHaveBeenNthCalledWith(
      1,
      new URL('https://broker.example.com/enqueue'),
      expect.objectContaining({ 'content-type': 'application/json' }),
      expect.any(Object),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('ytdlp.download_video'),
      }),
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      new URL('https://broker.example.com/result/task-123'),
      expect.objectContaining({ accept: 'application/json' }),
      expect.any(Object),
      { method: undefined, body: undefined },
    );
  });
});

function jsonResponse(url: string, value: unknown) {
  return {
    body: Readable.from([JSON.stringify(value)]),
    headers: { 'content-type': 'application/json' },
    status: 200,
    url: new URL(url),
  } as Awaited<ReturnType<typeof requestPublicHttp>>;
}

import { describe, expect, it } from 'vitest';

import {
  createBrokerDownloadPayload,
  parseBrokerDownloadResult,
} from './tiktokVideo.js';

describe('TikTok download broker contract', () => {
  it('enqueues the same yt-dlp download function and TikTok format used by gkbot', () => {
    expect(createBrokerDownloadPayload('https://www.tiktok.com/@creator/video/123')).toEqual({
      function: 'ytdlp.download_video',
      data: [
        'https://www.tiktok.com/@creator/video/123',
        {
          format: 'b[vcodec^=h264][acodec!=none]/b[acodec!=none]/bv*+ba/b',
          outtmpl: 'video.mp4',
        },
      ],
    });
  });

  it('accepts only an HTTP download URL as the completed task result', () => {
    expect(parseBrokerDownloadResult(' https://files.example.com/video.mp4 '))
      .toBe('https://files.example.com/video.mp4');
    expect(parseBrokerDownloadResult('{"status":"failed"}')).toBeNull();
    expect(parseBrokerDownloadResult(null)).toBeNull();
  });
});

import type { ServerResponse } from 'node:http';
import { pipeline } from 'node:stream/promises';

import type { PreviewImage, PreviewVideo } from '../application/previewContracts.js';

export function sendPreviewImage(response: ServerResponse, image: PreviewImage): void {
  response.writeHead(200, {
    'cache-control': 'public, max-age=3600',
    'content-length': image.body.byteLength,
    'content-type': image.contentType,
    'x-content-type-options': 'nosniff',
  });
  response.end(image.body);
}

export async function sendPreviewVideo(
  response: ServerResponse,
  video: PreviewVideo,
): Promise<void> {
  const headers: Record<string, string> = {
    'accept-ranges': video.acceptRanges,
    'cache-control': 'private, max-age=60',
    'content-type': video.contentType,
    'x-content-type-options': 'nosniff',
  };
  if (video.contentLength) headers['content-length'] = video.contentLength;
  if (video.contentRange) headers['content-range'] = video.contentRange;
  response.writeHead(video.status, headers);
  await pipeline(video.body, response);
}

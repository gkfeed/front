import type { ServerResponse } from 'node:http';

import type { PreviewImage } from '../application/previewPorts.js';

export function sendPreviewImage(response: ServerResponse, image: PreviewImage): void {
  response.writeHead(200, {
    'cache-control': 'public, max-age=3600',
    'content-length': image.body.byteLength,
    'content-type': image.contentType,
    'x-content-type-options': 'nosniff',
  });
  response.end(image.body);
}

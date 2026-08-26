import type { ServerResponse } from 'node:http';

import type { PreviewImage, PreviewRedirect } from '../application/previewContracts.js';

export function sendPreviewImage(response: ServerResponse, image: PreviewImage): void {
  response.writeHead(200, {
    'cache-control': 'public, max-age=3600',
    'content-length': image.body.byteLength,
    'content-type': image.contentType,
    'x-content-type-options': 'nosniff',
  });
  response.end(image.body);
}

export function sendPreviewRedirect(response: ServerResponse, redirect: PreviewRedirect): void {
  response.writeHead(302, {
    'cache-control': 'private, max-age=60',
    location: redirect.url,
    'x-content-type-options': 'nosniff',
  });
  response.end();
}

import { createServer } from 'node:http';

import { handleBffRequest } from './apiRouter.js';
import { sendJson } from './httpResponse.js';
import { PreviewError } from './preview/errors.js';
import { serveFrontend } from './staticServer.js';

const port = Number(process.env.PORT ?? 3000);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && await handleBffRequest(requestUrl, response)) return;

    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed' } });
      return;
    }

    await serveFrontend(requestUrl.pathname, request.method === 'HEAD', response);
  } catch (error) {
    const previewError = error instanceof PreviewError
      ? error
      : new PreviewError('An unexpected error occurred', 500, 'internal_error');
    sendJson(response, previewError.status, {
      error: { code: previewError.code, message: previewError.message },
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`GKFeed BFF listening on http://0.0.0.0:${port}`);
});

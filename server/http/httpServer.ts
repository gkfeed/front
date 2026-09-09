import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { handleBffRequest } from './apiRouter.js';
import { toHttpErrorResponse } from './httpErrorMapping.js';
import { sendJson } from './httpResponse.js';
import { createHttpRequestContext } from './requestContext.js';
import { serveFrontend } from './staticServer.js';

export type HttpServerDependencies = {
  handleBffRequest: typeof handleBffRequest;
  handleApiRequest?: ApiRequestHandler;
  serveFrontend: typeof serveFrontend;
};

type ApiRequestHandler = (
  request: IncomingMessage,
  requestUrl: URL,
  response: ServerResponse,
  context: ReturnType<typeof createHttpRequestContext>,
) => Promise<boolean>;

const noApiProxy: ApiRequestHandler = () => Promise.resolve(false);

const defaultDependencies: HttpServerDependencies = {
  handleBffRequest,
  handleApiRequest: noApiProxy,
  serveFrontend,
};

export function createHttpServer(
  dependencies: HttpServerDependencies = defaultDependencies,
): Server {
  return createServer((request, response) => {
    void handleHttpRequest(request, response, dependencies);
  });
}

export async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: HttpServerDependencies = defaultDependencies,
): Promise<void> {
  const context = createHttpRequestContext(request, response);
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (await dependencies.handleApiRequest?.(request, requestUrl, response, context)) return;

    if (request.method === 'GET' && await dependencies.handleBffRequest(
      requestUrl,
      response,
      context,
      undefined,
      request.socket.remoteAddress ?? 'unknown',
    )) return;

    if (requestUrl.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } });
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(response, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed' } });
      return;
    }

    await dependencies.serveFrontend(requestUrl.pathname, request.method === 'HEAD', response);
  } catch (error) {
    if (context.clientAborted || response.destroyed) return;
    const httpError = toHttpErrorResponse(error);
    sendJson(response, httpError.status, {
      error: { code: httpError.code, message: httpError.message },
    });
  } finally {
    context.dispose();
  }
}

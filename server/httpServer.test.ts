import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it, vi } from 'vitest';

import { handleHttpRequest } from './httpServer.js';
import { sendJson } from './httpResponse.js';

describe('HTTP server composition root', () => {
  it('wires BFF routing and static serving behind the HTTP boundary', async () => {
    const handleBffRequest = vi.fn().mockResolvedValue(false);
    const serveFrontend = vi.fn((_pathname, _headOnly, response) => {
      sendJson(response, 200, { source: 'frontend' });
    });
    const request = createRequest('/reader', 'GET');
    const response = createResponse();

    await handleHttpRequest(request, response, { handleBffRequest, serveFrontend });

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ source: 'frontend' }));
    expect(handleBffRequest).toHaveBeenCalledOnce();
    expect(serveFrontend).toHaveBeenCalledWith('/reader', false, response);
  });

  it('rejects unsupported methods before serving frontend content', async () => {
    const serveFrontend = vi.fn();
    const request = createRequest('/', 'POST');
    const response = createResponse();

    await handleHttpRequest(request, response, {
      handleBffRequest: vi.fn().mockResolvedValue(false),
      serveFrontend,
    });

    expect(response.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({
      error: { code: 'method_not_allowed', message: 'Method not allowed' },
    }));
    expect(serveFrontend).not.toHaveBeenCalled();
  });
});

function createRequest(url: string, method: string): IncomingMessage {
  const request = new EventEmitter() as IncomingMessage;
  Object.assign(request, {
    complete: true,
    headers: { host: 'localhost' },
    method,
    url,
  });
  return request;
}

function createResponse(): ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  const response = new EventEmitter() as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  response.destroyed = false;
  response.writableEnded = false;
  response.writeHead = vi.fn();
  response.end = vi.fn(() => {
    response.writableEnded = true;
    return response;
  });
  return response;
}

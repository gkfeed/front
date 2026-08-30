import { EventEmitter } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { handleHttpRequest } from './http/httpServer.js';
import { sendJson } from './http/httpResponse.js';
import { PreviewError } from './preview/errors.js';
import { serveFrontend } from './http/staticServer.js';

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
    expect(handleBffRequest).toHaveBeenCalledWith(
      expect.any(URL),
      response,
      expect.any(Object),
      undefined,
      '203.0.113.10',
    );
    expect(serveFrontend).toHaveBeenCalledWith('/reader', false, response);
  });

  it('routes desktop API proxy requests before the BFF and static server', async () => {
    const handleApiRequest = vi.fn().mockResolvedValue(true);
    const handleBffRequest = vi.fn();
    const serveFrontend = vi.fn();
    const request = createRequest('/api/v1/list', 'GET');
    const response = createResponse();

    await handleHttpRequest(request, response, { handleApiRequest, handleBffRequest, serveFrontend });

    expect(handleApiRequest).toHaveBeenCalledWith(request, expect.any(URL), response, expect.any(Object));
    expect(handleBffRequest).not.toHaveBeenCalled();
    expect(serveFrontend).not.toHaveBeenCalled();
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

  it('maps provider failures after BFF routing at the HTTP boundary', async () => {
    const request = createRequest('/bff/open-graph?url=https%3A%2F%2Fexample.com', 'GET');
    const response = createResponse();

    await handleHttpRequest(request, response, {
      handleBffRequest: vi.fn().mockRejectedValue(new PreviewError('Upstream failed', 'fetch_failed')),
      serveFrontend: vi.fn(),
    });

    expect(response.writeHead).toHaveBeenCalledWith(502, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({
      error: { code: 'fetch_failed', message: 'Upstream failed' },
    }));
  });

  it('maps malformed static paths after the real static transport fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gkfeed-http-'));
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    const request = createRequest('/%E0%A4%A', 'GET');
    const response = createResponse();

    try {
      await handleHttpRequest(request, response, {
        handleBffRequest: vi.fn().mockResolvedValue(false),
        serveFrontend: (pathname, headOnly, frontendResponse) => (
          serveFrontend(pathname, headOnly, frontendResponse, root)
        ),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({
      error: { code: 'invalid_path', message: 'Invalid path' },
    }));
  });
});

function createRequest(url: string, method: string): IncomingMessage {
  const request = new EventEmitter() as IncomingMessage;
  Object.assign(request, {
    complete: true,
    headers: { host: 'localhost' },
    method,
    socket: { remoteAddress: '203.0.113.10' },
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

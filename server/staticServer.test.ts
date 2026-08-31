import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { serveFrontend } from './http/staticServer.js';

describe('static server', () => {
  it('falls back to the application shell and supports HEAD responses', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gkfeed-static-'));
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    const response = createResponse();

    try {
      await serveFrontend('/missing-route', true, response, root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'content-type': 'text/html; charset=utf-8',
      'content-length': 15,
    }));
    expect(response.end).toHaveBeenCalledOnce();
  });

  it('reports malformed paths as HTTP boundary errors', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gkfeed-static-'));
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    const response = createResponse();

    try {
      await expect(serveFrontend('/%E0%A4%A', false, response, root))
        .rejects.toMatchObject({
          code: 'invalid_path',
          kind: 'invalid_path',
          status: 400,
        });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('streams existing assets with their transport metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gkfeed-static-'));
    await writeFile(join(root, 'index.html'), '<!doctype html>');
    await mkdir(join(root, 'assets'));
    await writeFile(join(root, 'assets', 'app.js'), 'console.log("ok")');
    const response = createStreamResponse();
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));

    try {
      await serveFrontend('/assets/app.js', false, response, root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': 'text/javascript; charset=utf-8',
      'content-length': 17,
    }));
    expect(Buffer.concat(chunks).toString()).toBe('console.log("ok")');
  });
});

function createResponse(): ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
} {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
  } as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
}

function createStreamResponse(): PassThrough & ServerResponse & {
  writeHead: ReturnType<typeof vi.fn>;
} {
  const response = new PassThrough() as PassThrough & ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
  };
  Object.assign(response, { writeHead: vi.fn() });
  return response;
}

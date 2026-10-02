import { EventEmitter, once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpRequestContext } from './http/requestContext.js';
import { requestPublicHttp } from './publicHttp.js';

vi.mock('./publicAddress.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./publicAddress.js')>(),
  resolvePublicAddress: async () => ({ address: '127.0.0.1', family: 4 }),
}));

describe('public HTTP timeouts', () => {
  let server: Server;

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.useRealTimers();
  });

  async function upstream(sendHeaders = true): Promise<URL> {
    server = createServer((_request, response) => {
      if (sendHeaders) {
        response.writeHead(200, { 'content-type': 'video/mp4' });
        response.write('first chunk');
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return new URL(`http://localhost:${(server.address() as AddressInfo).port}/video.mp4`);
  }

  it('keeps media open past both total deadlines and still aborts on client disconnect', async () => {
    const url = await upstream();
    const request = Object.assign(new EventEmitter(), { complete: true }) as IncomingMessage;
    const response = Object.assign(new EventEmitter(), { writableEnded: false }) as ServerResponse;
    const context = createHttpRequestContext(request, response);
    const media = await requestPublicHttp(url, {}, context, { streamBody: true });
    media.body.resume();
    const failure = once(media.body, 'error');

    context.startStreaming();
    await vi.advanceTimersByTimeAsync(16_000);
    expect(media.body.destroyed).toBe(false);
    expect(context.signal.aborted).toBe(false);
    expect(context.remainingMs(8_000)).toBe(8_000);

    response.emit('close');
    expect((await failure)[0]).toMatchObject({ reason: 'aborted' });
    expect(media.body.destroyed).toBe(true);
    expect(context.clientAborted).toBe(true);
    context.dispose();
  });

  it('retains the total download timeout for metadata bodies', async () => {
    const metadata = await requestPublicHttp(await upstream(), {});
    metadata.body.resume();
    const failure = once(metadata.body, 'error');

    await vi.advanceTimersByTimeAsync(8_000);

    expect((await failure)[0]).toMatchObject({ reason: 'timeout' });
    expect(metadata.body.destroyed).toBe(true);
  });

  it('still terminates a media body when its socket reports a stall', async () => {
    const media = await requestPublicHttp(await upstream(), {}, undefined, { streamBody: true });
    const failure = once(media.body, 'error');

    media.body.emit('timeout');

    expect((await failure)[0]).toMatchObject({ reason: 'timeout' });
    expect(media.body.destroyed).toBe(true);
  });

  it('times out media requests that never return headers', async () => {
    const url = await upstream(false);
    const receivedRequest = once(server, 'request');
    const failure = requestPublicHttp(url, {}, undefined, { streamBody: true }).catch((error: unknown) => error);
    await receivedRequest;

    await vi.advanceTimersByTimeAsync(8_000);

    expect(await failure).toMatchObject({ reason: 'timeout' });
  });
});

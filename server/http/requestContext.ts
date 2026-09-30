import type { IncomingMessage, ServerResponse } from 'node:http';

import { REQUEST_DEADLINE_MS } from '../timeouts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export interface HttpRequestContext extends RequestExecutionContext {
  readonly clientAborted: boolean;
  startStreaming(): void;
  dispose(): void;
}

export function createHttpRequestContext(
  request: IncomingMessage,
  response: ServerResponse,
  timeoutMs = REQUEST_DEADLINE_MS,
): HttpRequestContext {
  const controller = new AbortController();
  let deadline = Date.now() + timeoutMs;
  let clientAborted = false;
  let disposed = false;

  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const abortForClient = () => {
    if (disposed) return;
    clientAborted = true;
    controller.abort();
  };
  const onRequestClose = () => {
    if (!request.complete) abortForClient();
  };
  const onResponseClose = () => {
    if (!response.writableEnded) abortForClient();
  };

  request.once('aborted', abortForClient);
  request.once('close', onRequestClose);
  response.once('close', onResponseClose);

  return {
    signal: controller.signal,
    get deadline() {
      return deadline;
    },
    get clientAborted() {
      return clientAborted;
    },
    remainingMs(maximum = Number.POSITIVE_INFINITY) {
      return Math.max(0, Math.min(maximum, deadline - Date.now()));
    },
    startStreaming() {
      if (disposed || controller.signal.aborted) return;
      clearTimeout(timeout);
      deadline = Number.POSITIVE_INFINITY;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timeout);
      request.removeListener('aborted', abortForClient);
      request.removeListener('close', onRequestClose);
      response.removeListener('close', onResponseClose);
    },
  };
}

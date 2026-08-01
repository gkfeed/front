import type { IncomingMessage, ServerResponse } from 'node:http';

import { REQUEST_DEADLINE_MS } from './timeouts.js';

export interface RequestContext {
  readonly signal: AbortSignal;
  readonly deadline: number;
  readonly timedOut: boolean;
  readonly clientAborted: boolean;
  remainingMs(maximum?: number): number;
}

export interface ManagedRequestContext extends RequestContext {
  dispose(): void;
}

export function createRequestContext(
  request: IncomingMessage,
  response: ServerResponse,
  timeoutMs = REQUEST_DEADLINE_MS,
): ManagedRequestContext {
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  let timedOut = false;
  let clientAborted = false;
  let disposed = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

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
    deadline,
    get timedOut() {
      return timedOut;
    },
    get clientAborted() {
      return clientAborted;
    },
    remainingMs(maximum = Number.POSITIVE_INFINITY) {
      return Math.max(0, Math.min(maximum, deadline - Date.now()));
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

export function createDetachedRequestContext(): RequestContext {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    deadline: Number.POSITIVE_INFINITY,
    timedOut: false,
    clientAborted: false,
    remainingMs(maximum = Number.POSITIVE_INFINITY) {
      return maximum;
    },
  };
}

export function throwIfRequestAborted(context: RequestContext): void {
  if (context.signal.aborted) {
    throw new Error(context.timedOut ? 'Request deadline exceeded' : 'Request aborted');
  }
}

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from '../preview/errors.js';
import { createBffClientRegistry } from './bffClientRegistry.js';

const DEFAULT_MAX_ACTIVE = 24;
const DEFAULT_MAX_QUEUED = 32;
const DEFAULT_MAX_ACTIVE_PER_CLIENT = 2;
const DEFAULT_MAX_QUEUED_PER_CLIENT = 2;
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_RATE_WINDOW_MS = 60_000;
const DEFAULT_MAX_TRACKED_CLIENTS = 10_000;

export interface BffRequestGate {
  run<T>(clientId: string, context: RequestExecutionContext, load: () => Promise<T>): Promise<T>;
}

export interface BffRequestGateOptions {
  maxActive?: number;
  maxQueued?: number;
  maxActivePerClient?: number;
  maxQueuedPerClient?: number;
  rateLimit?: number;
  rateWindowMs?: number;
  now?: () => number;
  maxTrackedClients?: number;
}

type QueuedRequest = {
  clientId: string;
  context: RequestExecutionContext;
  start: () => void;
  reject: (error: Error) => void;
  abort: () => void;
};

export function createBffRequestGate({
  maxActive = DEFAULT_MAX_ACTIVE,
  maxQueued = DEFAULT_MAX_QUEUED,
  maxActivePerClient = DEFAULT_MAX_ACTIVE_PER_CLIENT,
  maxQueuedPerClient = DEFAULT_MAX_QUEUED_PER_CLIENT,
  rateLimit = DEFAULT_RATE_LIMIT,
  rateWindowMs = DEFAULT_RATE_WINDOW_MS,
  now = Date.now,
  maxTrackedClients = DEFAULT_MAX_TRACKED_CLIENTS,
}: BffRequestGateOptions = {}): BffRequestGate {
  const clients = createBffClientRegistry({ rateWindowMs, maxTrackedClients, now });
  const queue: QueuedRequest[] = [];
  let active = 0;

  function drainQueue(): void {
    while (active < maxActive) {
      const index = queue.findIndex((request) => (
        clients.get(request.clientId).active < maxActivePerClient
      ));
      if (index === -1) return;
      const [request] = queue.splice(index, 1);
      const state = clients.get(request.clientId);
      state.queued -= 1;
      request.context.signal.removeEventListener('abort', request.abort);
      request.start();
    }
  }

  async function execute<T>(clientId: string, load: () => Promise<T>): Promise<T> {
    const state = clients.get(clientId);
    active += 1;
    state.active += 1;
    try {
      return await load();
    } finally {
      active -= 1;
      state.active -= 1;
      clients.removeIfIdle(clientId, state);
      drainQueue();
    }
  }

  return {
    run<T>(clientId: string, context: RequestExecutionContext, load: () => Promise<T>): Promise<T> {
      const state = clients.get(clientId);
      if (state.requestsInWindow >= rateLimit) {
        return Promise.reject(new PreviewError('Too many preview requests from this client', 'preview_rate_limited'));
      }
      state.requestsInWindow += 1;

      if (active < maxActive && state.active < maxActivePerClient) {
        return execute(clientId, load);
      }
      if (queue.length >= maxQueued || state.queued >= maxQueuedPerClient) {
        return Promise.reject(new PreviewError('Too many preview requests are queued', 'preview_busy'));
      }

      return new Promise<T>((resolve, reject) => {
        const request: QueuedRequest = {
          clientId,
          context,
          start: () => void execute(clientId, load).then(resolve, reject),
          reject,
          abort: () => {
            const index = queue.indexOf(request);
            if (index === -1) return;
            queue.splice(index, 1);
            state.queued -= 1;
            clients.removeIfIdle(clientId, state);
            reject(new Error('Request aborted while waiting for a preview slot'));
          },
        };
        state.queued += 1;
        queue.push(request);
        context.signal.addEventListener('abort', request.abort, { once: true });
        if (context.signal.aborted) request.abort();
      });
    },
  };
}

export const bffRequestGate = createBffRequestGate();

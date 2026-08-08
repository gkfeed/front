import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from '../preview/errors.js';

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

type ClientState = {
  active: number;
  queued: number;
  windowStartedAt: number;
  requestsInWindow: number;
  lastSeenAt: number;
};

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
  const clients = new Map<string, ClientState>();
  const queue: QueuedRequest[] = [];
  let active = 0;
  let lastPrunedAt = 0;

  function pruneClients(timestamp: number): void {
    if (timestamp - lastPrunedAt < rateWindowMs && clients.size < maxTrackedClients) return;
    lastPrunedAt = timestamp;
    for (const [id, state] of clients) {
      if (state.active === 0 && state.queued === 0 && timestamp - state.lastSeenAt >= rateWindowMs) {
        clients.delete(id);
      }
    }
    while (clients.size >= maxTrackedClients) {
      let oldest: [string, ClientState] | undefined;
      for (const entry of clients) {
        if (entry[1].active !== 0 || entry[1].queued !== 0) continue;
        if (!oldest || entry[1].lastSeenAt < oldest[1].lastSeenAt) oldest = entry;
      }
      if (!oldest) break;
      clients.delete(oldest[0]);
    }
  }

  function getClient(clientId: string): ClientState {
    const timestamp = now();
    pruneClients(timestamp);
    let state = clients.get(clientId);
    if (!state) {
      state = {
        active: 0,
        queued: 0,
        windowStartedAt: timestamp,
        requestsInWindow: 0,
        lastSeenAt: timestamp,
      };
      clients.set(clientId, state);
    } else if (timestamp - state.windowStartedAt >= rateWindowMs) {
      state.windowStartedAt = timestamp;
      state.requestsInWindow = 0;
    }
    state.lastSeenAt = timestamp;
    return state;
  }

  function removeIdleClient(clientId: string, state: ClientState): void {
    if (state.active === 0 && state.queued === 0 && now() - state.windowStartedAt >= rateWindowMs) {
      clients.delete(clientId);
    }
  }

  function drainQueue(): void {
    while (active < maxActive) {
      const index = queue.findIndex((request) => (
        getClient(request.clientId).active < maxActivePerClient
      ));
      if (index === -1) return;
      const [request] = queue.splice(index, 1);
      const state = getClient(request.clientId);
      state.queued -= 1;
      request.context.signal.removeEventListener('abort', request.abort);
      request.start();
    }
  }

  async function execute<T>(clientId: string, load: () => Promise<T>): Promise<T> {
    const state = getClient(clientId);
    active += 1;
    state.active += 1;
    try {
      return await load();
    } finally {
      active -= 1;
      state.active -= 1;
      removeIdleClient(clientId, state);
      drainQueue();
    }
  }

  return {
    run<T>(clientId: string, context: RequestExecutionContext, load: () => Promise<T>): Promise<T> {
      const state = getClient(clientId);
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
            removeIdleClient(clientId, state);
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

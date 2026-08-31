export type BffClientState = {
  active: number;
  queued: number;
  windowStartedAt: number;
  requestsInWindow: number;
  lastSeenAt: number;
};

type BffClientRegistryOptions = {
  rateWindowMs: number;
  maxTrackedClients: number;
  now: () => number;
};

export type BffClientRegistry = {
  get: (clientId: string) => BffClientState;
  removeIfIdle: (clientId: string, state: BffClientState) => void;
};

export function createBffClientRegistry({
  rateWindowMs,
  maxTrackedClients,
  now,
}: BffClientRegistryOptions): BffClientRegistry {
  const clients = new Map<string, BffClientState>();
  let lastPrunedAt = 0;

  function prune(timestamp: number): void {
    if (timestamp - lastPrunedAt < rateWindowMs && clients.size < maxTrackedClients) return;
    lastPrunedAt = timestamp;

    for (const [id, state] of clients) {
      if (isInactive(state) && timestamp - state.lastSeenAt >= rateWindowMs) clients.delete(id);
    }

    while (clients.size >= maxTrackedClients) {
      const oldest = findOldestInactiveClient(clients);
      if (!oldest) break;
      clients.delete(oldest[0]);
    }
  }

  return {
    get(clientId: string): BffClientState {
      const timestamp = now();
      prune(timestamp);
      let state = clients.get(clientId);
      if (!state) {
        state = createClientState(timestamp);
        clients.set(clientId, state);
      } else if (timestamp - state.windowStartedAt >= rateWindowMs) {
        state.windowStartedAt = timestamp;
        state.requestsInWindow = 0;
      }
      state.lastSeenAt = timestamp;
      return state;
    },

    removeIfIdle(clientId: string, state: BffClientState): void {
      if (isInactive(state) && now() - state.windowStartedAt >= rateWindowMs) {
        clients.delete(clientId);
      }
    },
  };
}

function createClientState(timestamp: number): BffClientState {
  return {
    active: 0,
    queued: 0,
    windowStartedAt: timestamp,
    requestsInWindow: 0,
    lastSeenAt: timestamp,
  };
}

function isInactive(state: BffClientState): boolean {
  return state.active === 0 && state.queued === 0;
}

function findOldestInactiveClient(
  clients: ReadonlyMap<string, BffClientState>,
): [string, BffClientState] | undefined {
  let oldest: [string, BffClientState] | undefined;
  for (const entry of clients) {
    if (!isInactive(entry[1])) continue;
    if (!oldest || entry[1].lastSeenAt < oldest[1].lastSeenAt) oldest = entry;
  }
  return oldest;
}

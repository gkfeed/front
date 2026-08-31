export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export type TimeoutSignal = {
  signal: AbortSignal;
  readonly didTimeout: boolean;
  dispose: () => void;
};

export function createTimeoutSignal(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS): TimeoutSignal {
  const controller = new AbortController();
  const normalizedTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(0, timeoutMs) : DEFAULT_REQUEST_TIMEOUT_MS;
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, normalizedTimeoutMs);

  return {
    signal: controller.signal,
    get didTimeout() {
      return didTimeout;
    },
    dispose: () => clearTimeout(timeoutId),
  };
}

export function combineAbortSignals(...signals: Array<AbortSignal | null | undefined>): AbortSignal {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (activeSignals.length === 1 && activeSignals[0]) return activeSignals[0];
  return AbortSignal.any(activeSignals);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

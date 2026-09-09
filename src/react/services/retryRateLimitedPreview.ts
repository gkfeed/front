import { BffHttpError } from './bffClient';

// Cover the server's one-minute rate window without repeatedly hammering it.
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 32_000];

export async function retryRateLimitedPreview<T>(
  load: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    signal.throwIfAborted();
    try {
      return await load();
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (!(error instanceof BffHttpError) || error.status !== 429 || delay === undefined) {
        throw error;
      }
      await waitForRetry(delay, signal);
    }
  }
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

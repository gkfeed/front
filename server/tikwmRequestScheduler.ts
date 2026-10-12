import { setTimeout as delay } from 'node:timers/promises';
import {
  createDetachedRequestExecutionContext,
  isRequestDeadlineExceeded,
  type RequestExecutionContext,
} from './application/requestExecutionContext.js';
import { PublicHttpError } from './publicHttpError.js';

// TikWM's free API allows one request per second, across playback and comments.
const REQUEST_INTERVAL_MS = 1_100;

export function createTikwmRequestScheduler() {
  let nextStart = 0;
  let pending = Promise.resolve();

  return async (context = createDetachedRequestExecutionContext()): Promise<void> => {
    const turn = pending.then(async () => {
      throwIfAborted(context);
      const waitMs = Math.max(0, nextStart - Date.now());
      if (context.remainingMs() <= waitMs) throw new PublicHttpError('timeout');
      if (waitMs > 0) {
        try {
          await delay(waitMs, undefined, { signal: context.signal });
        } catch {
          throwIfAborted(context);
          throw new PublicHttpError('aborted');
        }
      }
      throwIfAborted(context);
      nextStart = Date.now() + REQUEST_INTERVAL_MS;
    });
    // A cancelled request must not block later requests or reserve a time slot.
    pending = turn.catch(() => undefined);
    await turn;
  };
}

function throwIfAborted(context: RequestExecutionContext) {
  if (isRequestDeadlineExceeded(context)) throw new PublicHttpError('timeout');
  if (context.signal.aborted) throw new PublicHttpError('aborted');
}

export const scheduleTikwmRequest = createTikwmRequestScheduler();

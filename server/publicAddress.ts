import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

import { PublicHttpError } from './publicHttpError.js';
import { isPrivateAddress } from './publicAddressPolicy.js';
import {
  isRequestDeadlineExceeded,
  type RequestExecutionContext,
} from './application/requestExecutionContext.js';

export { isPrivateAddress } from './publicAddressPolicy.js';

export async function resolvePublicAddress(
  url: URL,
  context?: RequestExecutionContext,
): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolveHostname(hostname, context);

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new PublicHttpError('private');
  }

  const selected = addresses[0]!;
  return { address: selected.address, family: selected.family === 6 ? 6 : 4 };
}

export function createPinnedLookup(address: { address: string; family: 4 | 6 }): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [address]);
      return;
    }
    callback(null, address.address, address.family);
  };
}

async function resolveHostname(hostname: string, context?: RequestExecutionContext) {
  try {
    const result = lookup(hostname, { all: true, verbatim: true });
    if (!context) return await result;
    return await raceWithContext(result, context);
  } catch {
    if (context && isRequestDeadlineExceeded(context)) throw new PublicHttpError('timeout');
    if (context?.signal.aborted) throw new PublicHttpError('aborted');
    throw new PublicHttpError('unresolvable');
  }
}

async function raceWithContext<T>(promise: Promise<T>, context: RequestExecutionContext): Promise<T> {
  if (context.signal.aborted) {
    throw new PublicHttpError(isRequestDeadlineExceeded(context) ? 'timeout' : 'aborted');
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      context.signal.removeEventListener('abort', onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(
      new PublicHttpError(isRequestDeadlineExceeded(context) ? 'timeout' : 'aborted'),
    ));
    context.signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

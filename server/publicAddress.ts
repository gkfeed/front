import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

import { PublicHttpError } from './publicHttpError.js';
import { isPrivateAddress } from './publicAddressPolicy.js';

export { isPrivateAddress } from './publicAddressPolicy.js';

export async function resolvePublicAddress(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await resolveHostname(hostname);

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

async function resolveHostname(hostname: string) {
  try {
    return await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new PublicHttpError('unresolvable');
  }
}

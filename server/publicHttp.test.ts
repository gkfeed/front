import { describe, expect, it } from 'vitest';

import { createPinnedLookup, isPrivateAddress } from './publicHttp.js';

describe('createPinnedLookup', () => {
  it('returns an address array when Node enables network family auto-selection', async () => {
    const address = { address: '93.184.216.34', family: 4 as const };
    const lookup = createPinnedLookup(address);

    await expect(new Promise((resolve, reject) => {
      lookup('example.com', { all: true }, (error, addresses) => {
        if (error) reject(error);
        else resolve(addresses);
      });
    })).resolves.toEqual([address]);
  });

  it('returns the address and family in single-address mode', async () => {
    const address = { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 as const };
    const lookup = createPinnedLookup(address);

    await expect(new Promise((resolve, reject) => {
      lookup('example.com', { all: false }, (error, resolvedAddress, family) => {
        if (error) reject(error);
        else resolve({ address: resolvedAddress, family });
      });
    })).resolves.toEqual(address);
  });
});

describe('isPrivateAddress', () => {
  it('rejects local, private, mapped, and reserved addresses', () => {
    [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.1.1',
      '::1',
      'fc00::1',
      '::ffff:127.0.0.1',
    ].forEach((address) => expect(isPrivateAddress(address)).toBe(true));
  });

  it('accepts public addresses', () => {
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
  });
});

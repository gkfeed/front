import { beforeEach, describe, expect, it, vi } from 'vitest';

const dnsLookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

import {
  createPinnedLookup,
  isPrivateAddress,
  resolvePublicAddress,
} from './publicAddress.js';

beforeEach(() => {
  dnsLookup.mockReset();
});

describe('isPrivateAddress', () => {
  it('rejects private, local, reserved, and special-use IPv4 addresses', () => {
    [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.1.1',
      '172.16.0.1',
      '192.0.0.1',
      '192.0.2.1',
      '192.168.1.1',
      '198.18.0.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
    ].forEach((address) => expect(isPrivateAddress(address), address).toBe(true));
  });

  it('rejects private, local, reserved, and special-use IPv6 addresses', () => {
    [
      '::',
      '::1',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:192.168.1.1',
      '::192.0.2.1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
    ].forEach((address) => expect(isPrivateAddress(address), address).toBe(true));
  });

  it('accepts globally routable IPv4 and IPv6 addresses', () => {
    expect(isPrivateAddress('93.184.216.34')).toBe(false);
    expect(isPrivateAddress('2606:2800:220:1:248:1893:25c8:1946')).toBe(false);
    expect(isPrivateAddress('::ffff:93.184.216.34')).toBe(false);
  });

  it('fails closed for invalid and hostname values', () => {
    ['localhost', '127.0.0.1.evil.example', 'not-an-address', '999.1.1.1'].forEach((address) => {
      expect(isPrivateAddress(address), address).toBe(true);
    });
  });
});

describe('resolvePublicAddress request cancellation', () => {
  it('stops waiting for DNS when the request context is aborted', async () => {
    const controller = new AbortController();
    dnsLookup.mockReturnValue(new Promise(() => {}));
    const context = {
      signal: controller.signal,
      deadline: Date.now() + 10_000,
      remainingMs: (maximum = Number.POSITIVE_INFINITY) => maximum,
    };

    const pending = resolvePublicAddress(new URL('https://example.com/'), context);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ reason: 'aborted' });
  });
});

describe('resolvePublicAddress', () => {
  it('rejects a literal local address without a DNS request', async () => {
    await expect(resolvePublicAddress(new URL('http://127.0.0.1/')))
      .rejects.toMatchObject({ reason: 'private' });
    expect(dnsLookup).not.toHaveBeenCalled();
  });

  it('rejects localhost when DNS resolves it to loopback', async () => {
    dnsLookup.mockResolvedValue([{ address: '::1', family: 6 }]);

    await expect(resolvePublicAddress(new URL('http://localhost/')))
      .rejects.toMatchObject({ reason: 'private' });
  });

  it('rejects a hostname when any DNS answer is private', async () => {
    dnsLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.7', family: 4 },
    ]);

    await expect(resolvePublicAddress(new URL('https://mixed.example/')))
      .rejects.toMatchObject({ reason: 'private' });
  });

  it('returns the first public DNS answer for pinning', async () => {
    dnsLookup.mockResolvedValue([
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
      { address: '93.184.216.34', family: 4 },
    ]);

    await expect(resolvePublicAddress(new URL('https://example.com/')))
      .resolves.toEqual({
        address: '2606:2800:220:1:248:1893:25c8:1946',
        family: 6,
      });
    expect(dnsLookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
  });

  it('maps DNS failures to an unresolvable public HTTP error', async () => {
    dnsLookup.mockRejectedValue(new Error('NXDOMAIN'));

    await expect(resolvePublicAddress(new URL('https://missing.example/')))
      .rejects.toMatchObject({ reason: 'unresolvable' });
  });
});

describe('createPinnedLookup', () => {
  it('always returns the validated address in all-address mode', async () => {
    const address = { address: '93.184.216.34', family: 4 as const };
    const lookup = createPinnedLookup(address);

    await expect(new Promise((resolve, reject) => {
      lookup('attacker-controlled.example', { all: true }, (error, addresses) => {
        if (error) reject(error);
        else resolve(addresses);
      });
    })).resolves.toEqual([address]);
  });

  it('always returns the validated address in single-address mode', async () => {
    const address = { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 as const };
    const lookup = createPinnedLookup(address);

    await expect(new Promise((resolve, reject) => {
      lookup('attacker-controlled.example', { all: false }, (error, resolvedAddress, family) => {
        if (error) reject(error);
        else resolve({ address: resolvedAddress, family });
      });
    })).resolves.toEqual(address);
  });
});

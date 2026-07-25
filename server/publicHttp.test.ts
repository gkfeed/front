import { describe, expect, it } from 'vitest';

import { isPrivateAddress } from './publicHttp.js';

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

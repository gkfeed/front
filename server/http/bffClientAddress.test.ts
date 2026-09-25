import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';

import { describe, expect, it } from 'vitest';

import { createBffClientAddressResolver } from './bffClientAddress.js';

function request(peer: string, forwarded?: string): IncomingMessage {
  const message = new EventEmitter() as IncomingMessage;
  Object.assign(message, {
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: peer },
  });
  return message;
}

describe('BFF client address', () => {
  const resolve = createBffClientAddressResolver('127.0.0.1/8,10.0.0.0/8,::1');

  it('ignores forwarded addresses from direct and untrusted connections', () => {
    expect(resolve(request('203.0.113.10', '198.51.100.1'))).toBe('203.0.113.10');
    expect(resolve(request('172.16.0.2', '198.51.100.1'))).toBe('172.16.0.2');
  });

  it('takes the first untrusted hop from the right of a trusted proxy chain', () => {
    expect(resolve(request('10.0.0.2', '198.51.100.99, 203.0.113.10, 10.0.0.1')))
      .toBe('203.0.113.10');
    expect(resolve(request('::ffff:10.0.0.2', '203.0.113.11'))).toBe('203.0.113.11');
    expect(resolve(request('::ffff:a00:2', '203.0.113.12'))).toBe('203.0.113.12');
    expect(resolve(request('::1', '2001:db8::1'))).toBe('2001:db8::1');
    expect(resolve(request('10.0.0.2', 'spoofed, 203.0.113.13'))).toBe('203.0.113.13');
  });

  it('falls back to the socket peer for malformed forwarded headers', () => {
    expect(resolve(request('10.0.0.2', '203.0.113.10, unknown'))).toBe('10.0.0.2');
    expect(resolve(request('10.0.0.2', '203.0.113.10, '))).toBe('10.0.0.2');
  });

  it('rejects invalid trusted proxy configuration', () => {
    expect(() => createBffClientAddressResolver('10.0.0.0/33')).toThrow('Invalid BFF_TRUSTED_PROXY_CIDRS');
  });
});

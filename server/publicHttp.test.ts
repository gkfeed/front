import { describe, expect, it } from 'vitest';

describe('public HTTP exports', () => {
  it('keeps the address policy available to the HTTP transport', async () => {
    const publicHttp = await import('./publicHttp.js');
    expect(publicHttp.isPrivateAddress('127.0.0.1')).toBe(true);
    expect(publicHttp.createPinnedLookup).toBeTypeOf('function');
  });
});

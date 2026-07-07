import { describe, expect, it } from 'vitest';

import { getRedirectTarget, getRouteLocation } from './routes';

describe('route helpers', () => {
  it('extracts redirect targets from router state', () => {
    const state = { from: { pathname: '/create', search: '?draft=1', hash: '#top' } };

    expect(getRouteLocation(state)).toEqual({ pathname: '/create', search: '?draft=1', hash: '#top' });
    expect(getRedirectTarget(state)).toBe('/create?draft=1#top');
  });

  it('falls back to home for invalid or login targets', () => {
    expect(getRedirectTarget(null)).toBe('/');
    expect(getRedirectTarget({ from: { pathname: '/login' } })).toBe('/');
    expect(getRedirectTarget({ from: { search: '?draft=1' } })).toBe('/');
  });
});

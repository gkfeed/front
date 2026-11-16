import { describe, expect, it } from 'vitest';
import { adaptSessionCookie } from './apiProxy';

describe('local HTTP session cookies', () => {
  it.each([
    'gkfeed.session=test; Path=/; Max-Age=2592000; Expires=Thu, 19 Nov 2026 09:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    'gkfeed.session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax',
    'gkfeed.session=test; secure; HttpOnly; SameSite=Lax',
    'gkfeed.session=test; HttpOnly; Secure',
  ])('removes only Secure from %s', (cookie) => {
    expect(adaptSessionCookie(cookie, false)).toBe(cookie.replace(/; [Ss]ecure/g, ''));
    expect(adaptSessionCookie(cookie, true)).toBe(cookie);
  });

  it.each([
    'another.session=test; HttpOnly; Secure; SameSite=Lax',
    'gkfeed.session.other=test; Secure',
    'gkfeed.session=Secure; Path=/; HttpOnly; SameSite=Lax',
    'gkfeed.session=test; Path=/Secure; HttpOnly; SameSite=Lax',
  ])('preserves unrelated cookies and attributes: %s', (cookie) => {
    expect(adaptSessionCookie(cookie, false)).toBe(cookie);
  });
});

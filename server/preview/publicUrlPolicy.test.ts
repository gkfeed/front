import { describe, expect, it } from 'vitest';

import { isRedirect, parsePublicHttpUrl } from './publicUrlPolicy.js';

describe('isRedirect', () => {
  it('recognizes every redirect status used by the fetch policy', () => {
    [301, 302, 303, 307, 308].forEach((status) => {
      expect(isRedirect(status), String(status)).toBe(true);
    });
  });

  it('does not treat non-redirect statuses as redirects', () => {
    [200, 201, 300, 304, 400, 500].forEach((status) => {
      expect(isRedirect(status), String(status)).toBe(false);
    });
  });
});

describe('parsePublicHttpUrl', () => {
  it('allows only credential-free HTTP(S) URLs', () => {
    expect(parsePublicHttpUrl('https://example.com/path').href).toBe('https://example.com/path');
    expect(parsePublicHttpUrl('http://127.0.0.1/').hostname).toBe('127.0.0.1');

    ['file:///etc/passwd', 'ftp://example.com/file', 'https://user@example.com/', 'not a url']
      .forEach((value) => expect(() => parsePublicHttpUrl(value)).toThrowError(/URL/));
  });
});

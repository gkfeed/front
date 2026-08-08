import { describe, expect, it } from 'vitest';

import { decodeHtml, resolveHttpUrl } from './html.js';

describe('decodeHtml', () => {
  it.each([
    '&#1114112;',
    '&#x110000;',
    '&#999999999999999999999999999;',
    '&#xFFFFFFFFFFFFFFFF;',
  ])('preserves numeric entity outside the Unicode range: %s', (entity) => {
    expect(decodeHtml(entity)).toBe(entity);
  });

  it('decodes valid numeric entities', () => {
    expect(decodeHtml('A &#38; &#x1F600; &#1114111; &#x10ffff;')).toBe(
      `A & 😀 ${String.fromCodePoint(0x10ffff)} ${String.fromCodePoint(0x10ffff)}`,
    );
  });
});

describe('resolveHttpUrl', () => {
  const base = new URL('https://news.example/articles/1');

  it('resolves public HTTP(S) subresources', () => {
    expect(resolveHttpUrl('/cover.jpg', base)).toBe('https://news.example/cover.jpg');
    expect(resolveHttpUrl('https://cdn.example/cover.jpg', base)).toBe('https://cdn.example/cover.jpg');
    expect(resolveHttpUrl('https://8.8.8.8/cover.jpg', base)).toBe('https://8.8.8.8/cover.jpg');
  });

  it.each([
    'http://192.168.1.1/router',
    'http://127.0.0.1/status',
    'http://2130706433/status',
    'http://0x7f000001/status',
    'http://[::1]/status',
    'http://[::ffff:192.168.1.1]/status',
    'http://localhost/status',
    'http://service.local/status',
    'http://intranet/status',
  ])('rejects a local browser subresource: %s', (value) => {
    expect(resolveHttpUrl(value, base)).toBeNull();
  });

  it('rejects credentials and non-HTTP protocols', () => {
    expect(resolveHttpUrl('https://user:secret@example.com/image.jpg', base)).toBeNull();
    expect(resolveHttpUrl('data:image/png;base64,AAAA', base)).toBeNull();
  });
});

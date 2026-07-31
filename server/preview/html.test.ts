import { describe, expect, it } from 'vitest';

import { decodeHtml } from './html.js';

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

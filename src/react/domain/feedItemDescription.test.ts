// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { getFeedItemDescription } from './feedItemDescription';

describe('getFeedItemDescription', () => {
  it('returns normalized visible HTML text without non-rendering elements', () => {
    expect(getFeedItemDescription(
      '<p>Video <strong>caption</strong> #topic</p><script>ignored()</script><style>.x{}</style><noscript>ignored</noscript>',
      'Different title',
    )).toBe('Video caption #topic');
  });

  it('does not return a description that only repeats the title', () => {
    expect(getFeedItemDescription('<p>  Creator video </p>', 'Creator video')).toBeNull();
  });
});

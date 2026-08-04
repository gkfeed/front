import { describe, expect, it } from 'vitest';

import { getReaderMode } from './readerMode';

describe('reader mode use case', () => {
  it('selects scroll mode only for the explicit scroll query', () => {
    expect(getReaderMode('?view=scroll')).toBe('scroll');
    expect(getReaderMode('')).toBe('review');
    expect(getReaderMode('?view=review')).toBe('review');
  });
});

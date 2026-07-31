import { describe, expect, it } from 'vitest';

import { getStringProperty, isRecord } from '../shared/valueGuards.js';

describe('value guards', () => {
  it('recognizes plain objects but not arrays or null', () => {
    expect(isRecord({ value: 'ok' })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('reads only string properties without coercion', () => {
    const value = { title: 'Story', count: 3, nested: { value: 'no' } };

    expect(getStringProperty(value, 'title')).toBe('Story');
    expect(getStringProperty(value, 'count')).toBeNull();
    expect(getStringProperty(value, 'missing')).toBeNull();
    expect(getStringProperty('not an object', 'title')).toBeNull();
  });
});

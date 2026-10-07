// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { getReaderMode, READER_MODE_STORAGE_KEY, setDefaultReaderMode, useDefaultReaderMode } from './readerMode';

beforeEach(() => {
  stubLocalStorage();
  setDefaultReaderMode('review');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  restoreLocalStorage();
});

describe('Reader default preference', () => {
  it('keeps an unsaved default when reads work but writes fail', () => {
    const { result } = renderHook(useDefaultReaderMode);
    const write = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });

    act(() => setDefaultReaderMode('scroll'));
    expect(result.current).toBe('scroll');
    expect(getReaderMode('')).toBe('scroll');
    expect(getReaderMode('?view=review')).toBe('review');
    expect(window.localStorage.getItem(READER_MODE_STORAGE_KEY)).toBe('review');

    write.mockRestore();
    const remounted = renderHook(useDefaultReaderMode);
    expect(remounted.result.current).toBe('scroll');
    act(() => setDefaultReaderMode('scroll'));
    expect(window.localStorage.getItem(READER_MODE_STORAGE_KEY)).toBe('scroll');
  });

  it('adopts a cross-tab reset after an unsaved change', () => {
    const { result } = renderHook(useDefaultReaderMode);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    act(() => setDefaultReaderMode('scroll'));
    expect(result.current).toBe('scroll');

    act(() => {
      window.localStorage.removeItem(READER_MODE_STORAGE_KEY);
      window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }));
    });
    expect(result.current).toBe('review');
  });
});

// @vitest-environment jsdom

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

import { getLiquipediaMatchPreview } from '../services/liquipedia';
import { getOpenGraphPreview } from '../services/openGraph';
import { clearPreviewCache } from '../services/previewQueue';
import type { FeedItem } from '../types';

vi.mock('../services/openGraph');
vi.mock('../services/liquipedia');

export const getPreview = vi.mocked(getOpenGraphPreview);
export const getLiquipediaPreview = vi.mocked(getLiquipediaMatchPreview);
export const item: FeedItem = {
  id: 1,
  feedId: 2,
  link: 'https://example.com/story',
  title: 'Story',
  text: '',
};

afterEach(() => {
  cleanup();
  clearPreviewCache();
  vi.useRealTimers();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

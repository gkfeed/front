// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FeedItem } from '../types';

const mocks = vi.hoisted(() => ({
  vk: vi.fn().mockResolvedValue({}),
  youtube: vi.fn().mockResolvedValue({}),
  tiktok: vi.fn().mockResolvedValue({}),
  disabled: new Set<string>(),
}));
vi.mock('../state/useNsfwPreferences', () => ({ useNsfwPreferences: () => ({ nsfwMode: 'show' }) }));
vi.mock('../state/usePluginPreferences', () => ({ usePluginPreferences: () => ({ disabledPlugins: mocks.disabled }) }));
vi.mock('./providers/feedPluginUiCatalog', () => ({
  feedPluginUiCatalog: {
    vk: { loadUi: mocks.vk }, youtube: { loadUi: mocks.youtube }, tiktok: { loadUi: mocks.tiktok },
  },
}));
import { ReaderProviderPreloader } from './ReaderProviderPreloader';

const items: FeedItem[] = [
  { id: 1, feedId: 1, link: 'https://example.com/1', title: '', text: '' },
  { id: 2, feedId: 1, link: 'https://vk.com/wall-1_2', title: '', text: '' },
  { id: 3, feedId: 1, link: 'https://youtube.com/watch?v=abcdefghijk', title: '', text: '' },
  { id: 4, feedId: 1, link: 'https://tiktok.com/@creator/video/4', title: '', text: '' },
  { id: 5, feedId: 1, link: 'https://youtube.com/watch?v=lmnopqrstuv', title: '', text: '' },
];

afterEach(() => { cleanup(); mocks.disabled.clear(); vi.clearAllMocks(); });

describe('review provider preloading', () => {
  it('loads modules for the next three cards and does not reload them as the queue advances', async () => {
    const view = render(<ReaderProviderPreloader enabled items={items} activeReviewIds={[1, 2, 3, 4, 5]} />);
    await waitFor(() => expect(mocks.vk).toHaveBeenCalledOnce());
    expect(mocks.youtube).toHaveBeenCalledOnce();
    expect(mocks.tiktok).toHaveBeenCalledOnce();
    view.rerender(<ReaderProviderPreloader enabled items={items} activeReviewIds={[2, 3, 4, 5]} />);
    await waitFor(() => expect(mocks.youtube).toHaveBeenCalledOnce());
    expect(mocks.tiktok).toHaveBeenCalledOnce();
  });

  it('does not load while review mode is disabled or for disabled plugins', async () => {
    mocks.disabled.add('vk');
    const view = render(<ReaderProviderPreloader enabled={false} items={items} activeReviewIds={[1, 2, 3]} />);
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(mocks.vk).not.toHaveBeenCalled();
    expect(mocks.youtube).not.toHaveBeenCalled();
    view.rerender(<ReaderProviderPreloader enabled items={items} activeReviewIds={[1, 2, 3]} />);
    await waitFor(() => expect(mocks.youtube).toHaveBeenCalledOnce());
    expect(mocks.vk).not.toHaveBeenCalled();
  });
});

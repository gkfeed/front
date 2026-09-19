// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
  FeedPriorityProvider,
  MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY,
} from '../state/FeedPriorityProvider';
import { FEED_PRIORITIES_STORAGE_KEY } from '../state/feedPriority';
import { getFeedDecisionsStorageKey } from '../state/useFeedDecisions';
import { getFeedItems } from '../services/feeds';
import { stubLocalStorage, restoreLocalStorage } from '../testUtils';
import { ReaderPage } from './ReaderPage';

vi.mock('../services/feeds');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

beforeEach(stubLocalStorage);

afterEach(() => {
  cleanup();
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('ReaderPage smart order', () => {
  it('orders review items by the keep rate of their feeds', async () => {
    const storage = stubLocalStorage();
    const items = [
      { id: 22, feedId: 5, link: 'https://example.com/low', title: 'Low keep rate', text: '' },
      { id: 21, feedId: 6, link: 'https://example.com/high', title: 'High keep rate', text: '' },
    ];
    storage.set(getFeedDecisionsStorageKey('reader'), JSON.stringify([
      { itemId: 1, feedId: 5, kept: false },
      { itemId: 2, feedId: 5, kept: true },
      { itemId: 3, feedId: 5, kept: false },
      { itemId: 4, feedId: 5, kept: false },
      { itemId: 5, feedId: 6, kept: true },
      { itemId: 6, feedId: 6, kept: true },
      { itemId: 7, feedId: 6, kept: true },
    ]));
    vi.mocked(getFeedItems).mockResolvedValue(items);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <FeedPriorityProvider>
          <ReaderPage />
        </FeedPriorityProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('High keep rate')).toBeTruthy();
    expect(screen.queryByText('Low keep rate')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Low keep rate')).toBeTruthy();

    await waitFor(() => expect(JSON.parse(storage.get(getFeedDecisionsStorageKey('reader')) ?? '[]')).toContainEqual({
      itemId: 21, feedId: 6, kept: true,
    }));
  });

  it('does not use keep rates when automatic prioritization is disabled', async () => {
    const storage = stubLocalStorage();
    storage.set(AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY, 'false');
    storage.set(getFeedDecisionsStorageKey('reader'), JSON.stringify([
      { itemId: 1, feedId: 5, kept: false },
      { itemId: 2, feedId: 6, kept: true },
    ]));
    vi.mocked(getFeedItems).mockResolvedValue([
      { id: 22, feedId: 5, link: 'https://example.com/newer', title: 'Newer item', text: '' },
      { id: 21, feedId: 6, link: 'https://example.com/older', title: 'Older item', text: '' },
    ]);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <FeedPriorityProvider>
          <ReaderPage />
        </FeedPriorityProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Newer item')).toBeTruthy();
    expect(screen.queryByText('Older item')).toBeNull();
  });

  it('does not use saved feed weights when manual prioritization is disabled', async () => {
    const storage = stubLocalStorage();
    storage.set(MANUAL_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY, 'false');
    storage.set(AUTOMATIC_FEED_PRIORITIZATION_ENABLED_STORAGE_KEY, 'false');
    storage.set(FEED_PRIORITIES_STORAGE_KEY, JSON.stringify({ 6: 99 }));
    vi.mocked(getFeedItems).mockResolvedValue([
      { id: 22, feedId: 5, link: 'https://example.com/newer', title: 'Newer item', text: '' },
      { id: 21, feedId: 6, link: 'https://example.com/older', title: 'Older item', text: '' },
    ]);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <FeedPriorityProvider>
          <ReaderPage />
        </FeedPriorityProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Newer item')).toBeTruthy();
    expect(screen.queryByText('Older item')).toBeNull();
  });
});

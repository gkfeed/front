// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getFeedDecisionsStorageKey,
} from '../state/useFeedDecisions';
import { FeedPriorityProvider } from '../state/FeedPriorityProvider';
import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { stubLocalStorage } from '../testUtils';
import { READER_ITEMS as ITEMS, resetReaderPageTest } from './ReaderPage.test.utils';
import { ReaderPage } from './ReaderPage';

vi.mock('../services/feeds');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

beforeEach(stubLocalStorage);

afterEach(() => {
  resetReaderPageTest();
});

describe('ReaderPage with feed priority provider', () => {
  it('records keep decisions and persists them for the signed-in user', async () => {
    const storage = stubLocalStorage();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <FeedPriorityProvider>
          <ReaderPage />
        </FeedPriorityProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    const decisionsKey = getFeedDecisionsStorageKey('reader');
    await waitFor(() => expect(JSON.parse(storage.get(decisionsKey) ?? '[]')).toEqual([
      { itemId: 11, feedId: 2, kept: true },
    ]));
    expect(vi.mocked(deleteFeedItemById)).not.toHaveBeenCalled();
  });

  it('records delete decisions as not kept', async () => {
    const storage = stubLocalStorage();
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <FeedPriorityProvider>
          <ReaderPage />
        </FeedPriorityProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    const decisionsKey = getFeedDecisionsStorageKey('reader');
    await waitFor(() => expect(JSON.parse(storage.get(decisionsKey) ?? '[]')).toEqual([
      { itemId: 11, feedId: 2, kept: false },
    ]));
    expect(vi.mocked(deleteFeedItemById)).toHaveBeenCalled();
  });
});

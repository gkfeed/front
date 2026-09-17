// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFeedDecisionsStorageKey } from '../state/useFeedDecisions';
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

describe('ReaderPage decisions', () => {
  it.each([
    { action: 'keep', kept: true, deleteCalls: 0 },
    { action: 'delete', kept: false, deleteCalls: 1 },
  ])('records $action decisions and persists them for the signed-in user', async ({ action, kept, deleteCalls }) => {
    const storage = stubLocalStorage();
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <ReaderPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(action, 'i') }));

    const decisionsKey = getFeedDecisionsStorageKey('reader');
    await waitFor(() => expect(JSON.parse(storage.get(decisionsKey) ?? '[]')).toEqual([
      { itemId: 11, feedId: 2, kept },
    ]));
    expect(vi.mocked(deleteFeedItemById)).toHaveBeenCalledTimes(deleteCalls);
  });
});

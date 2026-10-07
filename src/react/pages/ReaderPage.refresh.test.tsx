// @vitest-environment jsdom

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedItemById, getAllFeeds, getFeedItems } from '../services/feeds';
import { getReviewStateStorageKey } from '../hooks/reviewStateStorage';
import { stubLocalStorage } from '../testUtils';
import { READER_ITEMS as ITEMS, renderReader, resetReaderPageTest } from './ReaderPage.test.utils';

vi.mock('../services/feeds');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

beforeEach(stubLocalStorage);
afterEach(resetReaderPageTest);

const NEW_ITEM = { ...ITEMS[0], id: 12, title: 'New story' };

describe('ReaderPage background refresh', () => {
  it('keeps a revisited card and deletes that exact card after new items arrive', async () => {
    vi.mocked(getFeedItems).mockResolvedValueOnce(ITEMS).mockResolvedValueOnce([NEW_ITEM, ...ITEMS]);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    expect(await screen.findByText('Second story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });
    expect(await screen.findByText('First story')).toBeTruthy();
    const renderedCard = screen.getByRole('region', { name: 'Review view' });

    fireEvent.focus(window);
    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    await screen.findByText('2 remaining');
    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Review view' })).toBe(renderedCard);
    expect(screen.queryByText('New story')).toBeNull();

    fireEvent.keyDown(window, { key: 'd' });
    expect(await screen.findByText('New story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledExactlyOnceWith(11, { username: 'reader', password: 'secret' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(await screen.findByText('Second story')).toBeTruthy();
  });

  it.each(['web', 'rezka'].flatMap((type) => ['a', 'd'].map((key) => ({ type, key }))))(
    'keeps a $type card missing from an empty refresh until the user presses $key',
    async ({ type, key }) => {
      vi.mocked(getAllFeeds).mockResolvedValue([
        { id: 2, title: 'Source', type, url: 'https://example.com' },
      ]);
      vi.mocked(getFeedItems).mockResolvedValueOnce([ITEMS[0]]).mockResolvedValueOnce([]);
      vi.mocked(deleteFeedItemById).mockResolvedValue();
      renderReader();

      expect(await screen.findByText('First story')).toBeTruthy();
      await act(async () => fireEvent.focus(window));
      await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
      expect(screen.getByText('First story')).toBeTruthy();
      expect(screen.queryByText('You’re all caught up')).toBeNull();
      expect(screen.getByText('1 remaining')).toBeTruthy();

      fireEvent.keyDown(window, { key });
      expect(await screen.findByText('You’re all caught up')).toBeTruthy();
      if (key === 'd') {
        expect(deleteFeedItemById).toHaveBeenCalledExactlyOnceWith(11, { username: 'reader', password: 'secret' });
      } else {
        expect(deleteFeedItemById).not.toHaveBeenCalled();
      }
    },
  );

  it('keeps the visible card when an earlier restored item arrives on a later page', async () => {
    const storage = stubLocalStorage();
    storage.set(getReviewStateStorageKey('reader'), JSON.stringify({
      version: 1, pendingIds: [11, 10], revisitIds: [], keptItemIds: [],
    }));
    let publishProgress: ((items: typeof ITEMS) => boolean | void) | undefined;
    let finishLoad: ((items: typeof ITEMS) => void) | undefined;
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => {
      publishProgress = onProgress;
      return new Promise((resolve) => { finishLoad = resolve; });
    });
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    act(() => publishProgress?.([ITEMS[1]]));
    expect(await screen.findByText('Second story')).toBeTruthy();
    act(() => publishProgress?.(ITEMS));
    expect(screen.getByText('Second story')).toBeTruthy();
    await act(async () => finishLoad?.(ITEMS));
    expect(screen.getByText('Second story')).toBeTruthy();
    expect(screen.queryByText('First story')).toBeNull();
    fireEvent.keyDown(window, { key: 'd' });
    expect(await screen.findByText('First story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledExactlyOnceWith(10, { username: 'reader', password: 'secret' });
  });
});

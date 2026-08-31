// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getReviewStateStorageKey } from '../hooks/reviewStateStorage';
import { deleteFeedItemsCache } from '../services/feedItemsCache';
import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { NsfwPreferencesContext, type NsfwMode } from '../state/nsfwPreferencesContext';
import type { ReaderItemOrder } from '../state/readerItemOrder';
import { ReaderItemOrderPreferencesContext } from '../state/readerItemOrderPreferencesContext';
import { createStatusError, restoreLocalStorage, stubLocalStorage } from '../testUtils';
import { ReaderPage } from './ReaderPage';

vi.mock('../services/feeds');
vi.mock('../services/feedItemsCache');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

const ITEMS = [
  { id: 11, feedId: 2, link: 'https://example.com/one', title: 'First story', text: 'First summary' },
  { id: 10, feedId: 3, link: 'https://news.example.org/two', title: 'Second story', text: 'Second summary' },
];

function renderReader(
  initialEntry = '/reader',
  nsfwMode: NsfwMode = 'blur',
  container?: HTMLElement,
  itemOrder: ReaderItemOrder = 'desc',
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NsfwPreferencesContext value={{ nsfwMode, setNsfwMode: vi.fn() }}>
        <ReaderItemOrderPreferencesContext value={{ itemOrder, setItemOrder: vi.fn() }}>
          <ReaderPage />
        </ReaderItemOrderPreferencesContext>
      </NsfwPreferencesContext>
    </MemoryRouter>,
    container ? { container } : undefined,
  );
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('main').forEach((main) => main.remove());
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('ReaderPage', () => {
  it('shows the shared authentication message and keeps retry for 403', async () => {
    vi.mocked(getFeedItems)
      .mockRejectedValueOnce(createStatusError('forbidden', 403))
      .mockResolvedValueOnce(ITEMS);
    renderReader();

    expect((await screen.findByRole('alert')).textContent).toContain('Your session has expired. Please sign in again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('First story')).toBeTruthy();
  });

  it('keeps an item locally and advances without deleting it', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
    expect(screen.getByText('1 remaining')).toBeTruthy();
  });

  it('revisits kept items after all other items have been reviewed', async () => {
    const items = [
      ...ITEMS,
      { id: 9, feedId: 4, link: 'https://example.net/three', title: 'Third story', text: 'Third summary' },
    ];
    vi.mocked(getFeedItems).mockResolvedValue(items);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('First story')).toBeTruthy();
    expect(screen.getByText('3 remaining')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('You’ve reviewed everything')).toBeTruthy();
  });

  it('restores the review queue after the page is reloaded', async () => {
    stubLocalStorage();
    const newItem = {
      id: 12,
      feedId: 4,
      link: 'https://example.net/new',
      title: 'New story',
      text: 'New summary',
    };
    vi.mocked(getFeedItems)
      .mockResolvedValueOnce(ITEMS)
      .mockResolvedValueOnce([...ITEMS, newItem]);
    const firstRender = renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    firstRender.unmount();

    renderReader();

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('New story')).toBeTruthy();
    expect(screen.queryByText('First story')).toBeNull();
    expect(screen.getByText('2 remaining')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();
  });

  it('reconciles a saved review queue only after all cursor pages are loaded', async () => {
    const storage = stubLocalStorage();
    const storageKey = getReviewStateStorageKey('reader');
    storage.set(storageKey, JSON.stringify({
      version: 1,
      pendingIds: [98, 96],
      revisitIds: [],
      keptItemIds: [],
    }));
    const makeItem = (id: number) => ({
      ...ITEMS[0],
      id,
      title: `Story ${id}`,
    });
    const firstPage = Array.from({ length: 10 }, (_, index) => makeItem(110 - index));
    const allItems = [
      ...firstPage,
      ...Array.from({ length: 6 }, (_, index) => makeItem(100 - index)),
    ];
    let publishProgress: ((items: typeof allItems) => boolean | void) | undefined;
    let finishLoad: ((items: typeof allItems) => void) | undefined;
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => {
      publishProgress = onProgress;
      return new Promise((resolve) => {
        finishLoad = resolve;
      });
    });
    renderReader();

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    act(() => publishProgress?.(firstPage));
    expect(await screen.findByText('Story 110')).toBeTruthy();
    expect(storage.get(storageKey)).toContain('"pendingIds":[98,96]');

    act(() => publishProgress?.(allItems));
    expect(screen.getByText('Story 110')).toBeTruthy();

    await act(async () => finishLoad?.(allItems));
    expect(await screen.findByText('Story 110')).toBeTruthy();
    await waitFor(() => expect(JSON.parse(storage.get(storageKey) ?? '')).toEqual({
      version: 1,
      pendingIds: [110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95],
      revisitIds: [],
      keptItemIds: [],
    }));
  });

  it('resets kept items and persists the empty kept state', async () => {
    const storage = stubLocalStorage();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reset kept items' }));

    expect(await screen.findByText('First story')).toBeTruthy();
    expect(JSON.parse(storage.get(getReviewStateStorageKey('reader')) ?? '')).toEqual({
      version: 1,
      pendingIds: [11, 10],
      revisitIds: [],
      keptItemIds: [],
    });
  });

  it('starts with the newest item when a refresh finds several new items', async () => {
    stubLocalStorage();
    const newItems = [
      {
        id: 12,
        feedId: 4,
        link: 'https://example.net/new',
        title: 'New story',
        text: 'New summary',
      },
      {
        id: 13,
        feedId: 5,
        link: 'https://example.net/newest',
        title: 'Newest story',
        text: 'Newest summary',
      },
    ];
    vi.mocked(getFeedItems)
      .mockResolvedValueOnce(ITEMS)
      .mockResolvedValueOnce([...ITEMS, ...newItems]);
    const firstRender = renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    firstRender.unmount();

    renderReader();

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Newest story')).toBeTruthy();
    expect(screen.queryByText('New story')).toBeNull();
  });

  it('keeps the current item with a', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
  });

  it('keeps the current card selected while cursor pages extend the counter', async () => {
    const firstPage = [
      { ...ITEMS[0], id: 20, title: 'Current page item' },
      { ...ITEMS[1], id: 19, title: 'Stable selected item' },
    ];
    const nextPageItem = { ...ITEMS[1], id: 18, title: 'Older cursor item' };
    let publishProgress: ((items: typeof firstPage) => boolean | void) | undefined;
    let finishLoad: ((items: typeof firstPage) => void) | undefined;
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => {
      publishProgress = onProgress;
      return new Promise((resolve) => {
        finishLoad = resolve;
      });
    });
    renderReader();

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    act(() => publishProgress?.(firstPage));
    expect(await screen.findByText('Current page item')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Stable selected item')).toBeTruthy();

    act(() => publishProgress?.([...firstPage, nextPageItem]));
    expect(screen.getByText('Stable selected item')).toBeTruthy();
    expect(screen.queryByText('Current page item')).toBeNull();
    await waitFor(() => expect(screen.getByText('2 remaining')).toBeTruthy());

    await act(async () => finishLoad?.([...firstPage, nextPageItem]));
    expect(screen.getByText('Stable selected item')).toBeTruthy();
  });

  it('keeps partial items visible and offers retry when a later cursor page fails', async () => {
    let publishProgress: ((items: typeof ITEMS) => boolean | void) | undefined;
    let failLoad: ((error: Error) => void) | undefined;
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => {
      publishProgress = onProgress;
      return new Promise((_resolve, reject) => {
        failLoad = reject;
      });
    });
    renderReader('/reader?view=scroll');

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    act(() => publishProgress?.(ITEMS));
    expect(await screen.findByText('First story')).toBeTruthy();

    await act(async () => failLoad?.(new Error('Later page failed')));

    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Could not load your feed items.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('deletes the current item with d', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'd' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(11, { username: 'reader', password: 'secret' });
  });

  it('does not act on the old arrow shortcuts', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.queryByText('Second story')).toBeNull();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
  });

  it('switches to a continuous view of all feed items', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader('/reader?view=scroll');

    expect(await screen.findByText('First story')).toBeTruthy();
    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /keep/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('shows review items in the selected order', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader('/reader', 'blur', undefined, 'asc');

    expect(await screen.findByText('Second story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('First story')).toBeTruthy();
  });

  it('removes NSFW items from Review and the remaining count in hide mode', async () => {
    vi.mocked(getFeedItems).mockResolvedValue([
      {
        id: 9,
        feedId: 2,
        link: 'https://www.pornhub.com/view_video.php?viewkey=123',
        title: 'Hidden story',
        text: '',
      },
      ITEMS[1],
    ]);
    renderReader('/reader', 'hide');

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(screen.queryByText('Hidden story')).toBeNull();
    expect(screen.getByText('1 remaining')).toBeTruthy();
  });

  it('offers focused mobile controls for short videos', async () => {
    vi.mocked(getFeedItems).mockResolvedValue([{
      id: 20,
      feedId: 4,
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'Short video',
      text: '',
    }]);
    renderReader();

    expect(await screen.findByLabelText('Review controls')).toBeTruthy();
    expect(screen.queryByLabelText('More review actions')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Scroll view' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open original' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Show comments' })).toHaveLength(1);
  });

  it.each([
    ['TikTok', {
      id: 20,
      feedId: 4,
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'Short video',
      text: '',
    }],
    ['Instagram', {
      id: 21,
      feedId: 5,
      link: 'https://www.instagram.com/p/example/',
      title: 'inst: creator',
      text: '',
    }],
  ] as const)('automatically enters fullscreen for %s on mobile', async (_provider, item) => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    vi.mocked(getFeedItems).mockResolvedValue([item]);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Exit Reader fullscreen' }));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBeUndefined());
  });

  it('updates automatic fullscreen when the viewport crosses the mobile breakpoint', async () => {
    let viewportWidth = 1024;
    vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => viewportWidth);
    vi.mocked(getFeedItems).mockResolvedValue([{
      id: 20,
      feedId: 4,
      link: 'https://www.tiktok.com/@creator/video/123',
      title: 'Short video',
      text: '',
    }]);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByTitle('Video preview for Short video')).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBeUndefined();

    viewportWidth = 390;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBe('true'));

    viewportWidth = 1024;
    fireEvent(window, new Event('resize'));
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBeUndefined());
  });

  it('toggles fullscreen with the f keyboard shortcut', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'f' });

    await waitFor(() => {
      expect(document.documentElement.dataset.readerFullscreen).toBe('true');
      expect(screen.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: 'f' });

    await waitFor(() => {
      expect(document.documentElement.dataset.readerFullscreen).toBeUndefined();
      expect(screen.getByRole('button', { name: 'Open Reader fullscreen' })).toBeTruthy();
    });
  });

  it('keeps fullscreen active when keeping the current item', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBe('true'));

    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBe('true');
    expect(screen.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
  });

  it('keeps fullscreen active when deleting the current item', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    const main = document.createElement('main');
    document.body.append(main);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'f' });
    await waitFor(() => expect(document.documentElement.dataset.readerFullscreen).toBe('true'));

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(document.documentElement.dataset.readerFullscreen).toBe('true');
    expect(screen.getByRole('button', { name: 'Exit Reader fullscreen' })).toBeTruthy();
  });

  it('keeps review actions in the stable controls row after viewport changes', async () => {
    vi.mocked(getFeedItems).mockResolvedValue([ITEMS[0]]);
    renderReader();

    expect(await screen.findByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Feed item actions' })).toBeNull();

    fireEvent(window, new Event('resize'));

    expect(screen.getByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('keeps the controls row unchanged when the fullscreen main scrolls', async () => {
    const main = document.createElement('main');
    document.body.append(main);
    vi.mocked(getFeedItems).mockResolvedValue([ITEMS[0]]);
    renderReader('/reader', 'blur', main);

    expect(await screen.findByRole('button', { name: /keep/i })).toBeTruthy();

    fireEvent.scroll(document.querySelector('main')!);

    expect(screen.getByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('advances immediately while deleting the item in the background', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(11, { username: 'reader', password: 'secret' });
    await waitFor(() => expect(deleteFeedItemsCache).toHaveBeenCalledWith('reader'));
  });

  it('keeps deleted items out of Scroll view', async () => {
    const items = [
      {
        id: 11,
        feedId: 2,
        link: 'https://www.tiktok.com/@creator/video/123',
        title: 'Deleted video',
        text: '',
      },
      {
        id: 10,
        feedId: 3,
        link: 'https://www.tiktok.com/@creator/video/456',
        title: 'Remaining video',
        text: '',
      },
    ];
    vi.mocked(getFeedItems).mockResolvedValueOnce(items).mockResolvedValueOnce([items[1]]);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    const review = renderReader();

    expect(await screen.findByTitle('Video preview for Deleted video')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));

    expect(await screen.findByTitle('Video preview for Remaining video')).toBeTruthy();
    review.unmount();
    renderReader('/reader?view=scroll');

    expect(screen.queryByTitle('Video preview for Deleted video')).toBeNull();
    expect(await screen.findByTitle('Video preview for Remaining video')).toBeTruthy();
  });

  it('advances immediately and shows a title-specific retry notification after failure', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete “First story”');
    expect(screen.queryByText('First story')).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('retries a failed deletion without returning the item to the current card', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(deleteFeedItemById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Second story')).toBeTruthy();
  });

  it('keeps the next item interactive while an earlier deletion is pending', async () => {
    let resolveFirstDeletion: () => void = () => {};
    const firstDeletion = new Promise<void>((resolve) => {
      resolveFirstDeletion = resolve;
    });
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockImplementation(async (itemId) => {
      if (itemId === 11) await firstDeletion;
    });
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(deleteFeedItemById).toHaveBeenCalledTimes(1);
    resolveFirstDeletion();

    await waitFor(() => expect(deleteFeedItemById).toHaveBeenCalledTimes(2));
    expect(deleteFeedItemById).toHaveBeenLastCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('returns failed deletions to the end after a feed resync', async () => {
    vi.mocked(getFeedItems)
      .mockResolvedValueOnce(ITEMS)
      .mockResolvedValueOnce(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('You’ve reviewed everything')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Second story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('First story')).toBeTruthy();
  });

  it('can reload after reaching the end of the queue', async () => {
    vi.mocked(getFeedItems).mockResolvedValueOnce([]).mockResolvedValueOnce([ITEMS[0]]);
    renderReader();

    expect(await screen.findByText('You’re all caught up')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));

    await waitFor(() => expect(getFeedItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('First story')).toBeTruthy();
  });

  it('shows only the video name and channel copy for YouTube items', async () => {
    vi.mocked(getFeedItems).mockResolvedValue([{
      id: 20,
      feedId: 4,
      link: 'https://www.youtube.com/watch?v=abc123xyz',
      title: 'YT: Example Channel',
      text: 'Example video title',
    }]);
    renderReader();

    expect(await screen.findByRole('heading', { name: 'Example video title' })).toBeTruthy();
    expect(screen.getByText('Example Channel')).toBeTruthy();
    expect(screen.queryByText('Feed #4')).toBeNull();
    expect(screen.queryByText('youtube.com')).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
  });
});

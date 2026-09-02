// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedItemsCache } from '../services/feedItemsCache';
import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { READER_ITEMS as ITEMS, renderReader, resetReaderPageTest } from './ReaderPage.test.utils';

vi.mock('../services/feeds');
vi.mock('../services/feedItemsCache');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

afterEach(resetReaderPageTest);

describe('ReaderPage deletion', () => {
  it('advances immediately while deleting the item in the background', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

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

  it('advances immediately, retries once, and shows a title-specific final error', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete “First story”');
    expect(deleteFeedItemById).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('First story')).toBeNull();
    expect(screen.getByRole('button', { name: /Could not delete “First story”/ })).toBeTruthy();
  });

  it('returns a final failed deletion as current without consuming the next card', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();

    const notification = await screen.findByRole('button', { name: /Could not delete “First story”/ });
    notification.focus();
    fireEvent.keyDown(notification, { key: 'Enter', code: 'Enter' });
    fireEvent.click(notification);

    await waitFor(() => expect(deleteFeedItemById).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Second story')).toBeTruthy();
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

    expect(deleteFeedItemById).toHaveBeenCalledTimes(2);
    resolveFirstDeletion();

    await waitFor(() => expect(deleteFeedItemById).toHaveBeenCalledTimes(2));
    expect(deleteFeedItemById).toHaveBeenLastCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('returns a server-side card after a feed resync clears its final error', async () => {
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
    expect(await screen.findByText('First story')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps separate clickable notifications for multiple final errors', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Second story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
    const notifications = screen.getAllByRole('button', { name: /Could not delete/ });
    expect(notifications).toHaveLength(2);
    fireEvent.click(notifications[1]);

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

});

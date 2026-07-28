// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedItemById, getFeedItems } from '../services/feeds';
import { ReaderPage } from './ReaderPage';

vi.mock('../services/feeds');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

const ITEMS = [
  { id: 10, feedId: 2, link: 'https://example.com/one', title: 'First story', text: 'First summary' },
  { id: 11, feedId: 3, link: 'https://news.example.org/two', title: 'Second story', text: 'Second summary' },
];

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('ReaderPage', () => {
  it('keeps an item locally and advances without deleting it', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
    expect(screen.getByText('1 remaining')).toBeTruthy();
  });

  it('keeps the current item with a', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
  });

  it('deletes the current item with d', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'd' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('does not act on the old arrow shortcuts', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.queryByText('Second story')).toBeNull();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
  });

  it('switches to a continuous view of all feed items', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Scroll' }));

    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.getByText('Second story')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /keep/i })).toBeNull();
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
  });

  it('deletes a selected item from the scroll view', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Scroll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete First story' }));

    await waitFor(() => expect(screen.queryByText('First story')).toBeNull());
    expect(screen.getByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('keeps a scroll item visible when deletion fails', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Scroll' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete First story' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete this item');
    expect(screen.getByText('First story')).toBeTruthy();
  });

  it('deletes an item on the server before advancing', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('keeps a failed deletion visible for retry', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    render(<ReaderPage />);

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete this item');
    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.queryByText('Second story')).toBeNull();
  });

  it('can reload after reaching the end of the queue', async () => {
    vi.mocked(getFeedItems).mockResolvedValueOnce([]).mockResolvedValueOnce([ITEMS[0]]);
    render(<ReaderPage />);

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
    render(<ReaderPage />);

    expect(await screen.findByRole('heading', { name: 'Example video title' })).toBeTruthy();
    expect(screen.getByText('Example Channel')).toBeTruthy();
    expect(screen.queryByText('Feed #4')).toBeNull();
    expect(screen.queryByText('youtube.com')).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
  });
});

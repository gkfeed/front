// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

function renderReader(initialEntry = '/reader') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><ReaderPage /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('ReaderPage', () => {
  it('keeps an item locally and advances without deleting it', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
    expect(screen.getByText('1 remaining')).toBeTruthy();
  });

  it('keeps the current item with a', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'a' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).not.toHaveBeenCalled();
  });

  it('deletes the current item with d', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'd' });

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(10, { username: 'reader', password: 'secret' });
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
    expect(screen.getByLabelText('More review actions')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Show comments' })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Scroll view' }));

    expect(screen.queryByLabelText('Review controls')).toBeNull();
    expect(screen.getByTitle('Video preview for Short video')).toBeTruthy();
  });

  it('moves review actions to compact side buttons when they do not fit in the viewport', async () => {
    let viewportHeight = 600;
    vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => viewportHeight);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const bottom = this.classList.contains('reader-card') ? 900 : 0;
      return {
        x: 0,
        y: 0,
        top: 0,
        right: 464,
        bottom,
        left: 0,
        width: 464,
        height: bottom,
        toJSON: () => ({}),
      };
    });
    vi.mocked(getFeedItems).mockResolvedValue([ITEMS[0]]);
    renderReader();

    expect(await screen.findByRole('complementary', { name: 'Feed item actions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep item' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete item' })).toBeTruthy();

    viewportHeight = 1200;
    fireEvent(window, new Event('resize'));

    await waitFor(() => {
      expect(screen.queryByRole('complementary', { name: 'Feed item actions' })).toBeNull();
    });
    expect(screen.getByRole('button', { name: /keep/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete/i })).toBeTruthy();
  });

  it('deletes an item on the server before advancing', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(await screen.findByText('Second story')).toBeTruthy();
    expect(deleteFeedItemById).toHaveBeenCalledWith(10, { username: 'reader', password: 'secret' });
  });

  it('keeps a failed deletion visible for retry', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(deleteFeedItemById).mockRejectedValue(new Error('offline'));
    renderReader();

    expect(await screen.findByText('First story')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not delete this item');
    expect(screen.getByText('First story')).toBeTruthy();
    expect(screen.queryByText('Second story')).toBeNull();
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

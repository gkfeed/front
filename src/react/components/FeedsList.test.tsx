// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAllFeeds } from '../services/feeds';
import { AuthProvider } from '../state/AuthContext';
import { FeedSearchProvider } from '../state/FeedSearchContext';
import { FeedsList } from './FeedsList';
import { Navbar } from './Navbar';

vi.mock('../services/feeds');

const getFeeds = vi.mocked(getAllFeeds);
const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter><AuthProvider><FeedSearchProvider>{children}</FeedSearchProvider></AuthProvider></MemoryRouter>
);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedsList', () => {
  it('shows loading and loaded feed states', async () => {
    getFeeds.mockResolvedValue([{ id: 1, title: 'News', type: 'rss', url: 'https://example.com/feed.xml' }]);
    render(<><Navbar /><FeedsList /></>, { wrapper });

    expect(screen.getByLabelText('Loading feeds')).toBeTruthy();
    expect(screen.getByText('Loading feeds.')).toBeTruthy();
    expect(await screen.findByText('News')).toBeTruthy();
    expect(screen.getByText('Showing 1 feed.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search feeds'), { target: { value: 'missing' } });
    await waitFor(() => expect(screen.getByText('No matching feeds.')).toBeTruthy());
    expect(screen.getByText('No feeds found for search term missing.')).toBeTruthy();
  });

  it('keeps typing local and does not refetch while searching', async () => {
    getFeeds.mockResolvedValue([{ id: 1, title: 'News', type: 'rss', url: 'https://example.com/feed.xml' }]);
    render(<><Navbar /><FeedsList /></>, { wrapper });

    await screen.findByText('News');

    const searchInput = screen.getByLabelText('Search feeds') as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: 'n' } });
    fireEvent.change(searchInput, { target: { value: 'ne' } });
    fireEvent.change(searchInput, { target: { value: 'new' } });

    expect(searchInput.value).toBe('new');
    expect(getFeeds).toHaveBeenCalledTimes(1);
  });

  it('explains authentication failures', async () => {
    getFeeds
      .mockRejectedValueOnce(Object.assign(new Error('unauthorized'), { status: 401 }))
      .mockResolvedValueOnce([]);
    render(<FeedsList />, { wrapper });

    expect(await screen.findByText('Unable to load feeds. Log in and try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No feeds yet/)).toBeTruthy();
  });
});

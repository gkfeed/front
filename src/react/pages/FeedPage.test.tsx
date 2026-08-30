// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { createStatusError } from '../testUtils';
import { AppProviders } from '../state/AppProviders';
import { FeedPage } from './FeedPage';

vi.mock('../services/feeds');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedPage', () => {
  it('does not offer retry for missing feed routes', async () => {
    render(
      <MemoryRouter initialEntries={['/feed/0']}>
        <AppProviders>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe('Feed source not found.');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(vi.mocked(getFeedById)).not.toHaveBeenCalled();
  });

  it('offers retry for load failures', async () => {
    vi.mocked(getFeedById)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({
        id: 1,
        title: 'News',
        type: 'rss',
        url: 'https://example.com/feed.xml',
      });

    render(
      <MemoryRouter initialEntries={['/feed/1']}>
        <AppProviders>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe('Could not load this feed source.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('News')).toBeTruthy();
    expect(vi.mocked(getFeedById)).toHaveBeenCalledTimes(2);
  });

  it('shows the shared authentication message and keeps retry for 403', async () => {
    vi.mocked(getFeedById)
      .mockRejectedValueOnce(createStatusError('forbidden', 403))
      .mockResolvedValueOnce({
        id: 1,
        title: 'News',
        type: 'rss',
        url: 'https://example.com/feed.xml',
      });

    render(
      <MemoryRouter initialEntries={['/feed/1']}>
        <AppProviders>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe('Your session has expired. Please sign in again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('News')).toBeTruthy();
    expect(vi.mocked(getFeedById)).toHaveBeenCalledTimes(2);
  });

  it('keeps a 404 as not found without retry', async () => {
    vi.mocked(getFeedById).mockRejectedValueOnce(createStatusError('missing', 404));

    render(
      <MemoryRouter initialEntries={['/feed/1']}>
        <AppProviders>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toBe('Feed source not found.');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('keeps focus and confirmation available after delete failure', async () => {
    vi.mocked(getFeedById).mockResolvedValue({
      id: 1,
      title: 'News',
      type: 'rss',
      url: 'https://example.com/feed.xml',
    });
    vi.mocked(deleteFeedById).mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter initialEntries={['/feed/1']}>
        <AppProviders>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findByText('News')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    const deleteButton = screen.getByRole('button', { name: 'Delete feed source' });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    expect((await screen.findByRole('alert')).textContent).toBe('Could not delete this feed source. Try again.');
    expect(document.activeElement).toBe(deleteButton);
    expect(screen.getByRole('button', { name: 'Delete feed source' })).toBeTruthy();
  });
});

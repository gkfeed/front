// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFeedById, getFeedById } from '../services/feeds';
import { AuthProvider } from '../state/AuthContext';
import { FeedPage } from './FeedPage';

vi.mock('../services/feeds');

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedPage', () => {
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
        <AuthProvider>
          <Routes><Route path="/feed/:id" element={<FeedPage />} /></Routes>
        </AuthProvider>
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

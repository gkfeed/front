// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFeed } from '../services/feeds';
import { AuthProvider } from '../state/AuthContext';
import { FeedCreator } from './FeedCreator';

vi.mock('../services/feeds');

const create = vi.mocked(createFeed);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedCreator', () => {
  it('validates input and saves a feed', async () => {
    render(<AuthProvider><FeedCreator /></AuthProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Create feed' }));
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'News' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create feed' }));
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(create).not.toHaveBeenCalled();

    const input = { title: 'News', type: 'rss', url: 'https://example.com/feed.xml' };
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: input.url } });
    create.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Create feed' }));
    expect(await screen.findByText('Could not save feed source. Try again.')).toBeTruthy();
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('News');

    create.mockResolvedValueOnce({ id: 1, ...input });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  News  ' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://example.com/feed.xml  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenLastCalledWith(input, null);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });
});

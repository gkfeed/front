// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFeed, createFeedFromUrl } from '../services/feeds';
import { AuthProvider } from '../state/AuthContext';
import { getControlValue } from '../testUtils';
import { FeedCreator } from './FeedCreator';

vi.mock('../services/feeds');

const create = vi.mocked(createFeed);
const createLazy = vi.mocked(createFeedFromUrl);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('FeedCreator', () => {
  it('uses URL-only creation by default', async () => {
    render(<AuthProvider><FeedCreator /></AuthProvider>);

    expect(screen.getByRole('tab', { name: 'Lazy' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Extended' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Type' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('alert')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(create).not.toHaveBeenCalled();
    expect(createLazy).not.toHaveBeenCalled();

    createLazy.mockRejectedValueOnce(new Error('offline'));
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://www.youtube.com/@gkfeed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Could not save feed source. Try again.')).toBeTruthy();
    expect(getControlValue(screen.getByLabelText('URL'))).toBe('https://www.youtube.com/@gkfeed');

    createLazy.mockResolvedValueOnce();
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://www.youtube.com/@gkfeed  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(createLazy).toHaveBeenLastCalledWith({ url: 'https://www.youtube.com/@gkfeed' }, null);
    expect(create).not.toHaveBeenCalled();
    expect(getControlValue(screen.getByLabelText('URL'))).toBe('');
  });

  it('saves title and type from the extended tab', async () => {
    render(<AuthProvider><FeedCreator /></AuthProvider>);

    fireEvent.click(screen.getByRole('tab', { name: 'Extended' }));
    expect(screen.getByRole('tab', { name: 'Lazy' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'Extended' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('combobox', { name: 'Type' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'YouTube' }).getAttribute('value')).toBe('yt');

    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    const input = { title: 'News', type: 'yt', url: 'https://example.com/feed.xml' };
    create.mockResolvedValueOnce();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  News  ' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'yt' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://example.com/feed.xml  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenLastCalledWith(input, null);
    expect(createLazy).not.toHaveBeenCalled();
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('');
  });
});

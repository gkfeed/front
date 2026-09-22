// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../shared/previewContracts';
import { CreateFeedPage } from '../pages/CreateFeedPage';
import { createFeed, createFeedFromUrl } from '../services/feeds';
import { getFeedTypeSuggestion } from '../services/feedTypeSuggestion';
import { getOpenGraphPreview } from '../services/openGraph';
import { AppProviders } from '../state/AppProviders';
import { getControlValue } from '../testUtils';

vi.mock('../services/feeds');
vi.mock('../services/openGraph');
vi.mock('../services/feedTypeSuggestion');

const create = vi.mocked(createFeed);
const createLazy = vi.mocked(createFeedFromUrl);
const getPreview = vi.mocked(getOpenGraphPreview);
const detectType = vi.mocked(getFeedTypeSuggestion);

beforeEach(() => {
  detectType.mockResolvedValue({ type: 'web', confidence: 1 });
  getPreview.mockResolvedValue(preview(null));
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('CreateFeedPage', () => {
  it('shows one full form and saves its title, type, and URL', async () => {
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('URL')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Type Web' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Type Web' }));
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'YouTube' }).getAttribute('value')).toBe('yt');
    expect(screen.getByRole('radio', { name: 'Author.Today' }).getAttribute('value')).toBe('author.today');
    fireEvent.click(screen.getByRole('radio', { name: 'YouTube' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  News  ' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://example.com/feed.xml  ' } });
    create.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Could not save feed source. Try again.')).toBeTruthy();

    create.mockResolvedValueOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenLastCalledWith({
      title: 'News',
      type: 'yt',
      url: 'https://example.com/feed.xml',
    }, null);
    expect(createLazy).not.toHaveBeenCalled();
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('');
  });

  it('automatically selects the type and fills an empty title from URL metadata', async () => {
    detectType.mockResolvedValueOnce({ type: 'pornhub', confidence: 1 });
    getPreview.mockResolvedValueOnce(preview('Aquari'));
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://de.pornhub.com/model/aquari' },
    });

    expect(await screen.findByText('Selected with 100% confidence.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Type PornHub' })).toBeTruthy();
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('Aquari');
    expect(detectType).toHaveBeenCalledWith(
      'https://de.pornhub.com/model/aquari',
      '',
      expect.any(AbortSignal),
    );
    expect(getPreview).toHaveBeenCalledWith(
      'https://de.pornhub.com/model/aquari',
      expect.any(AbortSignal),
    );
  });

  it('does not replace a title entered by the user', async () => {
    detectType.mockResolvedValueOnce({ type: 'twitch', confidence: 0.91 });
    getPreview.mockResolvedValueOnce(preview('Generated channel name'));
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My streams' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://twitch.tv/gkfeed' } });

    expect(await screen.findByText('Selected with 91% confidence.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Type Twitch' })).toBeTruthy();
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('My streams');
  });
});

function preview(title: string | null): OpenGraphPreview {
  return {
    url: 'https://example.com',
    title,
    description: null,
    image: null,
    video: null,
    siteName: null,
    type: null,
    providerData: null,
  };
}

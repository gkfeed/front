// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFeed, createFeedFromUrl } from '../services/feeds';
import { getOpenGraphPreview } from '../services/openGraph';
import { getFeedTypeSuggestion } from '../services/feedTypeSuggestion';
import { AppProviders } from '../state/AppProviders';
import { getControlValue } from '../testUtils';
import { CreateFeedPage } from '../pages/CreateFeedPage';

vi.mock('../services/feeds');
vi.mock('../services/openGraph');
vi.mock('../services/feedTypeSuggestion');

const create = vi.mocked(createFeed);
const createLazy = vi.mocked(createFeedFromUrl);
const getPreview = vi.mocked(getOpenGraphPreview);
const detectType = vi.mocked(getFeedTypeSuggestion);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('CreateFeedPage', () => {
  it('uses URL-only creation by default', async () => {
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    expect(screen.getByRole('tab', { name: 'URL only' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Manual' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Type' })).toBeNull();

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

  it('canonicalizes a shared YouTube channel URL for lazy creation', async () => {
    render(<AppProviders><CreateFeedPage /></AppProviders>);
    createLazy.mockResolvedValueOnce();
    getPreview.mockResolvedValueOnce({
      url: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ',
      title: 'Fresh Technologies',
      description: null,
      image: null,
      video: null,
      siteName: 'YouTube',
      type: 'profile',
      providerData: null,
    });

    fireEvent.change(screen.getByLabelText('URL'), {
      target: {
        value: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ?si=9ox1NKEtHJ6v3YRg',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));

    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenCalledWith({
      title: 'Fresh Technologies',
      type: 'yt',
      url: 'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ',
    }, null);
    expect(getPreview).toHaveBeenCalledWith(
      'https://youtube.com/channel/UCSiRS-W-yfPOg3VK1tthlXQ',
    );
    expect(createLazy).not.toHaveBeenCalled();
  });

  it('saves title and type from the extended tab', async () => {
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    fireEvent.click(screen.getByRole('tab', { name: 'Manual' }));
    expect(screen.getByRole('tab', { name: 'URL only' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: 'Manual' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('button', { name: 'Type Web' }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Type Web' }));
    expect(screen.getByRole('radiogroup', { name: 'Type' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'YouTube' }).getAttribute('value')).toBe('yt');
    expect(screen.getByRole('radio', { name: 'Author.Today' }).getAttribute('value')).toBe('author.today');
    expect((screen.getByRole('radio', { name: 'Web' }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('URL').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByRole('alert')).toHaveLength(2);

    const input = { title: 'News', type: 'yt', url: 'https://example.com/feed.xml' };
    create.mockResolvedValueOnce();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '  News  ' } });
    fireEvent.click(screen.getByRole('radio', { name: 'YouTube' }));
    expect(screen.queryByRole('radiogroup', { name: 'Type' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Type YouTube' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: '  https://example.com/feed.xml  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenLastCalledWith(input, null);
    expect(createLazy).not.toHaveBeenCalled();
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('');
  });

  it('uses Jev to select a feed type from the URL', async () => {
    detectType.mockResolvedValueOnce({ type: 'twitch', confidence: 0.91 });
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    fireEvent.click(screen.getByRole('tab', { name: 'Manual' }));
    const detectButton = screen.getByRole('button', { name: 'Detect from URL' });
    expect((detectButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My streams' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://twitch.tv/gkfeed' } });
    fireEvent.click(detectButton);

    expect(await screen.findByText('Selected with 91% confidence.')).toBeTruthy();
    expect(detectType).toHaveBeenCalledWith('https://twitch.tv/gkfeed', 'My streams');
    expect(screen.getByRole('button', { name: 'Type Twitch' })).toBeTruthy();
  });
});

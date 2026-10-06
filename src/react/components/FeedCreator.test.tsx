// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OpenGraphPreview } from '../../../shared/previewContracts';
import { CreateFeedPage } from '../pages/CreateFeedPage';
import { createFeed, createFeedFromUrl } from '../services/feeds';
import { getFeedTypeSuggestion } from '../services/feedTypeSuggestion';
import { getOpenGraphPreview } from '../services/openGraph';
import { resolveYoutubeChannel } from '../services/youtubeChannel';
import { AppProviders } from '../state/AppProviders';
import { getControlValue } from '../testUtils';

vi.mock('../services/feeds');
vi.mock('../services/openGraph');
vi.mock('../services/feedTypeSuggestion');
vi.mock('../services/youtubeChannel');

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
  it('waits for Channel ID resolution before saving and keeps the manual title and type', async () => {
    let finishResolution!: (result: Awaited<ReturnType<typeof resolveYoutubeChannel>>) => void;
    vi.mocked(resolveYoutubeChannel).mockImplementationOnce(() => new Promise((resolve) => {
      finishResolution = resolve;
    }));
    render(<AppProviders><CreateFeedPage /></AppProviders>);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My games' } });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://www.youtube.com/@sendependa_dio_games/videos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Type Web' }));
    fireEvent.click(screen.getByRole('radio', { name: 'YouTube' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Saving source' }).hasAttribute('disabled')).toBe(true);

    finishResolution({
      channelId: 'UC5TRrMsWLy7flttFTyS-bOA',
      url: 'https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/videos',
    });
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenCalledWith({
      title: 'My games', type: 'yt', url: 'https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/videos',
    }, null);
  });

  it('keeps input and uses the existing save error when resolution fails, then allows retry', async () => {
    vi.mocked(resolveYoutubeChannel).mockRejectedValueOnce(new Error('HTTP 404'));
    render(<AppProviders><CreateFeedPage /></AppProviders>);
    const input = 'https://www.youtube.com/@sendependa_dio/videos';
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My games' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: input } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));

    expect(await screen.findByText('Could not save feed source. Try again.')).toBeTruthy();
    expect(getControlValue(screen.getByLabelText('URL'))).toBe(input);
    expect(getControlValue(screen.getByLabelText('Title'))).toBe('My games');
    expect(create).not.toHaveBeenCalled();
    expect(createLazy).not.toHaveBeenCalled();

    vi.mocked(resolveYoutubeChannel).mockResolvedValueOnce({
      channelId: 'UC5TRrMsWLy7flttFTyS-bOA',
      url: 'https://www.youtube.com/channel/UC5TRrMsWLy7flttFTyS-bOA/videos',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add feed' }));
    expect(await screen.findByText('Feed source saved.')).toBeTruthy();
    expect(create).toHaveBeenCalledOnce();
    expect(resolveYoutubeChannel).toHaveBeenCalledTimes(2);
  });

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

  it('keeps a manually selected type when detection finishes later', async () => {
    let finishDetection!: (suggestion: Awaited<ReturnType<typeof getFeedTypeSuggestion>>) => void;
    detectType.mockImplementationOnce(() => new Promise((resolve) => {
      finishDetection = resolve;
    }));
    render(<AppProviders><CreateFeedPage /></AppProviders>);

    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/feed.xml' },
    });
    await screen.findByText('Detecting...');
    fireEvent.click(screen.getByRole('button', { name: 'Type Web' }));
    fireEvent.click(screen.getByRole('radio', { name: 'YouTube' }));
    finishDetection({ type: 'twitch', confidence: 1 });

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: 'Type YouTube' })).toBeTruthy();
    });
    expect(screen.queryByText('Selected with 100% confidence.')).toBeNull();
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

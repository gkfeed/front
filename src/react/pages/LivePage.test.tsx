// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLiveTwitchItems } from '../services/twitch';
import { LivePage } from './LivePage';

vi.mock('../services/twitch');
vi.mock('../services/openGraph');
vi.mock('../services/liquipedia');
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

const LIVE_ITEM = {
  id: 10,
  feedId: 2,
  link: 'https://www.twitch.tv/some_channel',
  title: 'Some channel is live',
  text: '',
};
const SECOND_LIVE_ITEM = {
  ...LIVE_ITEM,
  id: 11,
  link: 'https://www.twitch.tv/another_channel',
  title: 'Another channel is live',
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('LivePage', () => {
  it('announces the loading state and labels the live channel group', async () => {
    let resolveItems: ((items: typeof LIVE_ITEM[]) => void) | undefined;
    vi.mocked(getLiveTwitchItems).mockImplementation(
      () => new Promise((resolve) => { resolveItems = resolve; }),
    );
    render(<LivePage />);

    expect(screen.getByRole('status').textContent).toContain('Checking Twitch channels');

    resolveItems?.([LIVE_ITEM]);

    expect(await screen.findByRole('list', { name: 'Live Twitch channels' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Live' })).toBeTruthy();
  });

  it('shows live Twitch items as selectable streams', async () => {
    vi.mocked(getLiveTwitchItems).mockResolvedValue([LIVE_ITEM, SECOND_LIVE_ITEM]);
    render(<LivePage />);

    const firstChannel = await screen.findByRole('button', { name: 'some_channel' });
    const secondChannel = screen.getByRole('button', { name: 'another_channel' });
    expect(firstChannel.getAttribute('aria-pressed')).toBe('true');
    expect(secondChannel.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByAltText('some_channel live stream preview')).toBeTruthy();

    fireEvent.click(secondChannel);

    expect(secondChannel.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByAltText('another_channel live stream preview')).toBeTruthy();
  });

  it('opens the selected channel in the Twitch player', async () => {
    vi.mocked(getLiveTwitchItems).mockResolvedValue([LIVE_ITEM]);
    render(<LivePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Play some_channel on Twitch' }));

    const player = screen.getByTitle('some_channel Twitch player');
    expect(player.getAttribute('src')).toContain('https://player.twitch.tv/?');
    expect(player.getAttribute('src')).toContain('channel=some_channel');
    expect(player.getAttribute('src')).toContain('parent=localhost');
  });

  it('stops the current player when another live channel is selected', async () => {
    vi.mocked(getLiveTwitchItems).mockResolvedValue([LIVE_ITEM, SECOND_LIVE_ITEM]);
    render(<LivePage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Play some_channel on Twitch' }));
    expect(screen.getByTitle('some_channel Twitch player')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'another_channel' }));

    expect(screen.queryByTitle('some_channel Twitch player')).toBeNull();
    expect(screen.getByRole('button', { name: 'Play another_channel on Twitch' })).toBeTruthy();
  });

  it('shows a clear empty state when all Twitch feeds are offline', async () => {
    vi.mocked(getLiveTwitchItems).mockResolvedValue([]);
    render(<LivePage />);

    expect(await screen.findByRole('heading', { name: 'No one is live' })).toBeTruthy();
    expect(screen.getByText('Your Twitch feeds are currently offline.')).toBeTruthy();
  });

  it('retries a failed live status check', async () => {
    vi.mocked(getLiveTwitchItems)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([LIVE_ITEM]);
    render(<LivePage />);

    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(getLiveTwitchItems).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'some_channel' })).toBeTruthy();
  });
});

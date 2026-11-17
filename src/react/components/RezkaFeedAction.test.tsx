// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { AuthContext } from '../state/authContext';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import type { FeatureUseCases } from '../application/featureComposition';
import type { AuthContextValue } from '../state/authContext';
import { RezkaFeedAction } from './RezkaFeedAction';

const item = { id: 1, feedId: 3, title: 'Жизнь заново', text: '', link: 'https://hdrezka.me/series/comedy/93395-old-latest.html' };
const feed = { id: 12, title: 'Жизнь заново', type: 'rezka', url: 'https://rezka.ag/series/comedy/93395-new.html' };
const auth = { credentials: null } as AuthContextValue;
const setup = (loadFeeds: ReturnType<typeof vi.fn>, saveFeed = vi.fn()) => {
  const services = { feeds: { loadFeeds, saveFeed } } as unknown as FeatureUseCases;
  render(<MemoryRouter><AuthContext value={auth}><FeatureUseCasesContext value={services}><RezkaFeedAction item={item} /></FeatureUseCasesContext></AuthContext></MemoryRouter>);
  return { saveFeed };
};
afterEach(cleanup);

describe('Rezka feed action', () => {
  it('links to an existing title even if the host and slug differ', async () => {
    const { saveFeed } = setup(vi.fn().mockResolvedValue([feed]));
    expect((await screen.findByRole('link', { name: /already in feed/i })).getAttribute('href')).toBe('/feed/12');
    expect(saveFeed).not.toHaveBeenCalled();
  });

  it('creates a feed and links to it after refreshing', async () => {
    const loadFeeds = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([feed]);
    const { saveFeed } = setup(loadFeeds, vi.fn().mockResolvedValue(undefined));
    fireEvent.click(await screen.findByRole('button', { name: /add to feed/i }));
    await screen.findByRole('link', { name: /already in feed/i });
    expect(saveFeed).toHaveBeenCalledWith({ title: item.title, type: 'rezka', url: item.link }, 'extended', null);
  });

  it('rechecks before creating and does not duplicate a title added meanwhile', async () => {
    const { saveFeed } = setup(vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([feed]));
    fireEvent.click(await screen.findByRole('button', { name: /add to feed/i }));
    await screen.findByRole('link', { name: /already in feed/i });
    expect(saveFeed).not.toHaveBeenCalled();
  });

  it('offers retry when the feed lookup fails', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    setup(load);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await waitFor(() => expect((screen.getByRole('button', { name: /add to feed/i }) as HTMLButtonElement).disabled).toBe(false));
  });
});

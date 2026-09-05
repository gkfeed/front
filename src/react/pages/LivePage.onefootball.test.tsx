// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../i18n';
import { LivePage } from './LivePage';
import { getOpenGraphPreview } from '../services/openGraph';
import { getFeedItems } from '../services/feeds';
import { readLiveCandidateCatalog, writeLiveCandidateCatalog } from '../services/liveCandidateCatalog';
import type { OneFootballMatchSnapshot } from '../../../shared/previewContracts';
import { liveProviderRegistry, catalogCandidates } from '../components/live/liveProviderRegistry';

vi.mock('../services/openGraph');
vi.mock('../services/feeds');
vi.mock('../services/liveCandidateCatalog');
vi.mock('../state/useAuth', () => {
  const credentials = { username: 'test', password: 'test' };
  return { useAuth: () => ({ credentials }) };
});
const item = { id: 1, feedId: 1, title: 'Match', text: '', link: 'https://onefootball.com/en/match/2674760' };
function preview(normalizedStatus: OneFootballMatchSnapshot['normalizedStatus']) {
  return {
    url: item.link, title: null, description: null, image: null, video: null, siteName: null, type: null,
    providerData: {
      provider: 'onefootball' as const,
      snapshot: {
        teams: [{ name: 'Home', logo: null }, { name: 'Away', logo: null }] as OneFootballMatchSnapshot['teams'],
        score: ['1', '0'] as [string, string], competition: null, status: "30'", startsAt: null, normalizedStatus,
      },
    },
  };
}
async function flush() { await act(async () => {}); }
beforeEach(async () => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  await i18n.changeLanguage('en');
  vi.mocked(readLiveCandidateCatalog).mockResolvedValue(undefined);
  vi.mocked(writeLiveCandidateCatalog).mockResolvedValue();
  vi.mocked(getFeedItems).mockResolvedValue([item]);
  vi.mocked(getOpenGraphPreview).mockResolvedValue(preview('live'));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('OneFootball on the live page', () => {
  it.each([['en', 'Football', 'opens in a new tab'], ['ru', 'Футбол', 'откроется в новой вкладке']])(
    'renders the Football section with an accessible external link in %s', async (locale, heading, hint) => {
      await i18n.changeLanguage(locale);
      render(<LivePage />);
      await flush();
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
      const link = screen.getByRole('link', { name: `Home 1–0 Away, ${hint}` });
      expect(link.getAttribute('href')).toBe(item.link);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    },
  );

  it('does not add an empty Football section while checking candidates', async () => {
    vi.mocked(getOpenGraphPreview).mockReturnValue(new Promise(() => {}));
    render(<LivePage />);
    await flush();
    expect(screen.queryByRole('heading', { name: 'Football' })).toBeNull();
  });

  it.each(['scheduled', 'over', 'postponed', null] as const)('hides %s matches', async (state) => {
    vi.mocked(getOpenGraphPreview).mockResolvedValue(preview(state));
    render(<LivePage />);
    await flush();
    expect(screen.queryByRole('heading', { name: 'Football' })).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('removes a live match after the next successful refresh completes it', async () => {
    render(<LivePage />);
    await flush();
    expect(screen.getByRole('link')).toBeTruthy();
    vi.mocked(getOpenGraphPreview).mockResolvedValue(preview('over'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Football' })).toBeNull();
  });

  it('warns on refresh failure, retains the last score, and expires it at five minutes', async () => {
    render(<LivePage />);
    await flush();
    vi.mocked(getOpenGraphPreview).mockRejectedValue(new Error('Offline'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole('link')).toBeTruthy();
    expect(screen.getByText(i18n.t('live.partialWarning'))).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(239_999); });
    expect(screen.getByRole('link')).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('deduplicates supported localized URLs by provider event ID', () => {
    const candidates = catalogCandidates(['en/match', 'de/spiel', 'es/partido', 'it/partita'].map((path, index) => ({
      ...item, id: index, link: `https://onefootball.com/${path}/2674760?test=${index}`,
    })), liveProviderRegistry);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ providerId: 'onefootball', eventId: '2674760' });
  });
});

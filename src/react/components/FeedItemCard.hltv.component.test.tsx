// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard HLTV previews', () => {
  it('shows an HLTV Open Graph match image without duplicating its content', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/og-vs-spirit-blast-bounty-2026-season-2',
      title: 'OG vs Spirit at BLAST Bounty 2026 Season 2',
      description: 'Complete overview of the OG vs. Spirit matchup',
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2999-07-23T18:05:00.000Z',
          teams: null,
          status: 'scheduled',
          score: null,
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/og-vs-spirit-blast-bounty-2026-season-2',
      title: 'OG vs Spirit',
      text: 'Upcoming match: OG vs Spirit',
    }} />);

    const image = await screen.findByAltText('Preview for OG vs Spirit at BLAST Bounty 2026 Season 2');
    expect(image.getAttribute('src')).toBe('https://api.url2png.com/v6/account/signature/png/?url=match');
    expect(image.closest('.reader-card--image-preview')).toBeTruthy();
    expect(image.closest('.reader-card--reddit-preview')).toBeNull();
    expect(screen.queryByText('hltv.org')).toBeNull();
    expect(screen.queryByText('Feed #2')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'OG vs Spirit' })).toBeNull();
    expect(screen.queryByText(/read original/i)).toBeNull();
    expect(screen.getByText(/^Starts in /)).toBeTruthy();
  });

  it('uses parsed teams instead of a generated HLTV screenshot for scheduled matches', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396021/spirit-vs-mouz-blast-bounty-2026-season-2-finals',
      title: 'Spirit vs MOUZ at BLAST Bounty 2026 Season 2 Finals',
      description: 'Complete overview of the Spirit vs. MOUZ matchup',
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2999-07-23T18:05:00.000Z',
          teams: [
            { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
            { name: 'MOUZ', logo: 'https://img-cdn.hltv.org/teamlogo/mouz.png' },
          ],
          status: 'scheduled',
          score: null,
          currentMap: null,
          completedMaps: [],
          playerStats: null,
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396021/spirit-vs-mouz-blast-bounty-2026-season-2-finals',
      title: 'Spirit vs MOUZ',
    }} />);

    expect(await screen.findByRole('link', { name: 'Spirit versus MOUZ' })).toBeTruthy();
    expect(screen.getByText('Spirit')).toBeTruthy();
    expect(screen.getByText('MOUZ')).toBeTruthy();
    expect(screen.queryByAltText(/Spirit vs MOUZ at/)).toBeNull();
    expect(screen.getByText(/^Starts in /)).toBeTruthy();
  });

  it('does not show an HLTV countdown after the match start', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
      title: 'OG vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2000-01-01T00:00:00.000Z',
          teams: null,
          status: 'scheduled',
          score: null,
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/og-vs-spirit-event',
    }} />);

    expect(await screen.findByAltText('Preview for OG vs Spirit')).toBeTruthy();
    expect(screen.queryByText(/^Starts in /)).toBeNull();
  });

  it('shows the final score in the native matchup when teams are available', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2026-07-23T18:05:00.000Z',
          teams: [
            { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
            { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
          ],
          status: 'over',
          score: ['1', '2'],
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
    }} />);

    expect(await screen.findByRole('link', {
      name: 'Liquid versus Spirit, final score 1 to 2',
    })).toBeTruthy();
    expect(screen.getByText('1 : 2')).toBeTruthy();
    expect(screen.queryByAltText('Preview for Liquid vs Spirit')).toBeNull();
  });

  it('converts a generated HLTV image into the live matchup format', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://api.url2png.com/v6/account/signature/png/?url=match',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: '2026-07-23T18:05:00.000Z',
          teams: [
            { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
            { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
          ],
          status: 'live',
          score: ['1', '0'],
          currentMap: { name: 'Anubis', score: ['12', '10'] },
          completedMaps: null,
          playerStats: [
            [
              { nickname: 'NAF', kills: 18, deaths: 12, assists: 4, adr: 91.3 },
              { nickname: 'YEKINDAR', kills: 14, deaths: 15, assists: 2, adr: 75.6 },
            ],
            [
              { nickname: 'donk', kills: 20, deaths: 14, assists: 3, adr: 104.8 },
              { nickname: 'magixx', kills: 16, deaths: 15, assists: 4, adr: 98.2 },
            ],
          ],
          teamSides: ['ct', 't'],
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
    }} />);

    expect(await screen.findByRole('link', {
      name: 'Liquid versus Spirit, live score 1 to 0, current map Anubis 12 to 10, Liquid CT, Spirit T',
    })).toBeTruthy();
    expect(screen.queryByAltText('Preview for Liquid vs Spirit')).toBeNull();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Anubis')).toBeTruthy();
    expect(screen.getByText('12').classList.contains('reader-card__hltv-current-map-score--ct')).toBe(true);
    expect(screen.getByText('10').classList.contains('reader-card__hltv-current-map-score--t')).toBe(true);
    expect(screen.getByText('Player stats')).toBeTruthy();
    expect(screen.getByText('NAF')).toBeTruthy();
    expect(screen.getByText('18–12')).toBeTruthy();
    expect(screen.getByText('104.8')).toBeTruthy();
    expect(screen.getByText('NAF').closest('tr')?.classList.contains('reader-card__hltv-player-row--best-adr')).toBe(false);
    expect(screen.getByText('YEKINDAR').closest('tr')?.classList.contains('reader-card__hltv-player-row--best-adr')).toBe(false);
    expect(screen.getByText('donk').closest('tr')?.classList.contains('reader-card__hltv-player-row--best-adr')).toBe(true);
    expect(screen.getByText('magixx').closest('tr')?.classList.contains('reader-card__hltv-player-row--best-adr')).toBe(false);
  });

  it('emphasizes the winner instead of the sides after a live map ends', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          teams: [
            { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
            { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
          ],
          status: 'live',
          score: ['0', '1'],
          currentMap: { name: 'Dust2', score: ['7', '13'] },
          completedMaps: null,
          playerStats: null,
          teamSides: ['t', 'ct'],
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
    }} />);

    expect(await screen.findByRole('link', {
      name: 'Liquid versus Spirit, live score 0 to 1, current map Dust2 7 to 13',
    })).toBeTruthy();
    const mapScore = screen.getByText('Dust2').parentElement
      ?.querySelector('.reader-card__hltv-current-map-score');
    expect(mapScore?.children[0]?.classList.contains('reader-card__hltv-current-map-score--loser')).toBe(true);
    expect(mapScore?.children[2]?.classList.contains('reader-card__hltv-current-map-score--winner')).toBe(true);
    expect(mapScore?.querySelector('[class$="--ct"], [class$="--t"]')).toBeNull();
  });

  it('keeps completed maps visible after the next map starts', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: 'website',
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          teams: [
            { name: 'Liquid', logo: 'https://img-cdn.hltv.org/teamlogo/liquid.png' },
            { name: 'Spirit', logo: 'https://img-cdn.hltv.org/teamlogo/spirit.png' },
          ],
          status: 'live',
          score: ['0', '1'],
          completedMaps: [{ name: 'Dust2', score: ['7', '13'] }],
          currentMap: { name: 'Anubis', score: ['0', '0'] },
          playerStats: null,
          teamSides: ['ct', 't'],
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
    }} />);

    expect(await screen.findByRole('link', {
      name: 'Liquid versus Spirit, live score 0 to 1, current map Anubis 0 to 0, completed maps Dust2 7 to 13, Liquid CT, Spirit T',
    })).toBeTruthy();
    expect(screen.getByText('Dust2')).toBeTruthy();
    expect(screen.getByText('Anubis')).toBeTruthy();
    const completedScore = screen.getByText('Dust2').parentElement
      ?.querySelector('.reader-card__hltv-current-map-score');
    expect(completedScore?.children[2]?.classList.contains('reader-card__hltv-current-map-score--winner')).toBe(true);
  });

  it('keeps player stats collapsed until requested and exposes table semantics', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event',
      title: 'Liquid vs Spirit',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: null,
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          status: 'live',
          teams: [
            { name: 'Liquid', logo: null },
            { name: 'Spirit', logo: null },
          ],
          score: ['1', '0'],
          currentMap: null,
          completedMaps: null,
          playerStats: [
            [{ nickname: 'NAF', kills: 18, deaths: 12, assists: 4, adr: 91.3 }],
            [{ nickname: 'donk', kills: 20, deaths: 14, assists: 3, adr: 104.8 }],
          ],
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{ ...item, link: 'https://www.hltv.org/matches/2396006/liquid-vs-spirit-event' }} />);

    const summary = await screen.findByText('Player stats');
    const details = summary.closest('details');
    expect(details?.open).toBe(false);

    fireEvent.click(summary);

    expect(details?.open).toBe(true);
    const liquidTable = screen.getByRole('table', { name: 'Liquid' });
    expect(liquidTable).toBeTruthy();
    expect(within(liquidTable).getByRole('columnheader', { name: 'Player' })).toBeTruthy();
    expect(within(liquidTable).getByTitle('Average damage per round')).toBeTruthy();
  });

  it('replaces the generic HLTV image with a team matchup', async () => {
    getPreview.mockResolvedValue({
      url: 'https://www.hltv.org/matches/2396281/ence-vs-bojong-event',
      title: 'HLTV.org - The home of competitive Counter-Strike',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: null,
      providerData: {
        provider: 'hltv',
        snapshot: {
          startsAt: null,
          teams: [
            { name: 'ENCE', logo: 'https://img-cdn.hltv.org/teamlogo/ence.png' },
            { name: 'BOJONG', logo: 'https://img-cdn.hltv.org/teamlogo/bojong.png' },
          ],
          status: 'scheduled',
          score: null,
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://www.hltv.org/matches/2396281/ence-vs-bojong-event',
    }} />);

    expect(await screen.findByRole('link', { name: 'ENCE versus BOJONG' })).toBeTruthy();
    expect(screen.getByText('ENCE')).toBeTruthy();
    expect(screen.getByText('BOJONG')).toBeTruthy();
    expect(screen.queryByAltText(/HLTV/)).toBeNull();
  });

  it('shows and refreshes the score while an HLTV match is live', async () => {
    vi.useFakeTimers();
    const basePreview = {
      url: 'https://www.hltv.org/matches/2396277/ww-vs-tdk-event',
      title: 'WW vs TDK',
      description: null,
      image: 'https://www.hltv.org/img/static/openGraphHltvLogo.png',
      video: null,
      siteName: 'HLTV.org',
      type: null,
      providerData: {
        provider: 'hltv' as const,
        snapshot: {
          startsAt: '2026-07-30T10:00:00.000Z',
          teams: [
            { name: 'WW', logo: 'https://img-cdn.hltv.org/teamlogo/ww.png' },
            { name: 'TDK', logo: 'https://img-cdn.hltv.org/teamlogo/tdk.png' },
          ] as [{ name: string; logo: string }, { name: string; logo: string }],
          status: 'live' as const,
          score: null,
          currentMap: null,
          completedMaps: null,
          playerStats: null,
          teamSides: null,
        },
      },
    };
    getPreview
      .mockResolvedValueOnce({
        ...basePreview,
        providerData: {
          ...basePreview.providerData,
          snapshot: { ...basePreview.providerData.snapshot, score: ['1', '0'], currentMap: { name: 'Anubis', score: ['12', '10'] } },
        },
      })
      .mockResolvedValueOnce({
        ...basePreview,
        providerData: {
          ...basePreview.providerData,
          snapshot: { ...basePreview.providerData.snapshot, score: ['1', '0'], currentMap: null },
        },
      })
      .mockResolvedValueOnce({
        ...basePreview,
        providerData: {
          ...basePreview.providerData,
          snapshot: { ...basePreview.providerData.snapshot, status: 'scheduled', score: null, currentMap: null },
        },
      })
      .mockResolvedValueOnce({
        ...basePreview,
        providerData: {
          ...basePreview.providerData,
          snapshot: { ...basePreview.providerData.snapshot, score: ['1', '0'], currentMap: { name: 'Anubis', score: ['12', '11'] } },
        },
      })
      .mockResolvedValueOnce({
        ...basePreview,
        providerData: {
          ...basePreview.providerData,
          snapshot: { ...basePreview.providerData.snapshot, status: 'over', score: ['1', '2'], currentMap: null },
        },
      });

    render(<FeedItemCard item={{ ...item, link: basePreview.url }} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('link', { name: 'WW versus TDK, live score 1 to 0, current map Anubis 12 to 10' })).toBeTruthy();
    expect(screen.getByText('Player stats')).toBeTruthy();
    expect(screen.getByText('Waiting for player stats…')).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('link', { name: 'WW versus TDK, live score 1 to 0, current map Anubis 12 to 10' })).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole('link', { name: 'WW versus TDK, live score 1 to 0, current map Anubis 12 to 10' })).toBeTruthy();

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole('link', { name: 'WW versus TDK, live score 1 to 0, current map Anubis 12 to 11' })).toBeTruthy();
    expect(screen.getByText('Anubis').parentElement
      ?.querySelector('.reader-card__hltv-current-map-score')?.textContent).toBe('12:11');

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByRole('link', { name: 'WW versus TDK, final score 1 to 2' })).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByText('Anubis')).toBeNull();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPreview).toHaveBeenCalledTimes(5);
  });
});

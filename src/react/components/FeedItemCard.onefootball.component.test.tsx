// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard OneFootball previews', () => {
  it('shows the parsed final score instead of the stale match image', async () => {
    getPreview.mockResolvedValue({
      url: 'https://onefootball.com/en/match/2700208',
      title: 'Barcelona vs Rayo Vallecano - LaLiga',
      description: 'See the results',
      image: 'https://photobooth-api.onefootball.com/stale-kickoff.png',
      video: null,
      siteName: 'OneFootball',
      type: null,
      providerData: {
        provider: 'onefootball',
        snapshot: {
          competition: 'LaLiga',
          teams: [
            { name: 'Barcelona', logo: 'https://images.onefootball.com/barcelona.png' },
            { name: 'Rayo Vallecano', logo: 'https://images.onefootball.com/rayo.png' },
          ],
          score: ['5', '2'],
          status: 'Full time',
          normalizedStatus: null,
          startsAt: '2026-08-31T19:30:00Z',
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://onefootball.com/en/match/2700208',
      title: 'Barcelona vs Rayo Vallecano',
      text: '<img src="https://photobooth-api.onefootball.com/stale-kickoff.png">',
    }} />);

    expect(await screen.findByLabelText('Barcelona 5–2 Rayo Vallecano')).toBeTruthy();
    expect(screen.getByText('5 : 2')).toBeTruthy();
    expect(screen.queryByText('Full time')).toBeNull();
    expect(screen.queryByText('LaLiga')).toBeNull();
    expect(screen.queryByText('ONEFOOTBALL')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Barcelona vs Rayo Vallecano' })).toBeNull();
    expect(screen.queryByText('onefootball.com')).toBeNull();
    expect(screen.queryByText('Feed item #2')).toBeNull();
    expect(screen.queryByText('Open original')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Barcelona vs Rayo Vallecano' })).toBeNull();
  });
});

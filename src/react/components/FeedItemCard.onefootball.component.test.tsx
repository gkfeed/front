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
          competitionLogo: 'https://images.onefootball.com/laliga.png',
          teams: [
            { name: 'Barcelona', logo: 'https://images.onefootball.com/barcelona.png', goals: [
              { scorer: 'Raphinha', minute: "45+2'", label: null },
              { scorer: 'Florian Lejeune', minute: "51'", label: 'Own goal' },
            ] },
            { name: 'Rayo Vallecano', logo: 'https://images.onefootball.com/rayo.png' },
          ],
          score: ['5', '2'],
          status: 'Full time',
          normalizedStatus: 'over',
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
    expect(screen.getByText('Raphinha')).toBeTruthy();
    expect(screen.getByText("45+2'")).toBeTruthy();
    expect(screen.getByText('Florian Lejeune (Own goal)')).toBeTruthy();
    expect(screen.getByText('Full time')).toBeTruthy();
    expect(screen.getByText('LaLiga')).toBeTruthy();
    expect(screen.queryByText('ONEFOOTBALL')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Barcelona vs Rayo Vallecano' })).toBeNull();
    expect(screen.queryByText('onefootball.com')).toBeNull();
    expect(screen.queryByText('Feed item #2')).toBeNull();
    expect(screen.queryByText('Open original')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Barcelona vs Rayo Vallecano' })).toBeNull();
  });

  it('renders a scheduled match natively without the generated image or repeated title', async () => {
    getPreview.mockResolvedValue({
      url: 'https://onefootball.com/en/match/2693593',
      title: 'Manchester United vs Manchester City',
      description: null,
      image: 'https://photobooth-api.onefootball.com/kickoff.png',
      video: null,
      siteName: 'OneFootball',
      type: null,
      providerData: {
        provider: 'onefootball',
        snapshot: {
          competition: 'Premier League',
          competitionLogo: null,
          teams: [
            { name: 'Manchester United', logo: null },
            { name: 'Manchester City', logo: null },
          ],
          score: null,
          status: null,
          normalizedStatus: 'scheduled',
          startsAt: '2026-09-13T13:30:00Z',
        },
      },
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://onefootball.com/en/match/2693593',
      title: 'Manchester United vs Manchester City',
      text: '<img src="https://photobooth-api.onefootball.com/kickoff.png">',
    }} />);

    expect(await screen.findByLabelText('Manchester United / Manchester City')).toBeTruthy();
    expect(screen.getByText('Premier League')).toBeTruthy();
    expect(screen.getByText(/Kick-off at/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Manchester United vs Manchester City' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Manchester United vs Manchester City' })).toBeNull();
  });

  it('shows a skeleton before match data replaces a local image', async () => {
    getPreview.mockReturnValue(new Promise(() => {}));

    render(<FeedItemCard item={{
      ...item,
      link: 'https://onefootball.com/en/match/2693593',
      text: '<img src="https://photobooth-api.onefootball.com/kickoff.png">',
    }} />);

    expect(await screen.findByRole('status', { name: 'Loading preview' })).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('falls back to the original image without restoring the repeated title', async () => {
    getPreview.mockRejectedValue(new Error('Offline'));

    render(<FeedItemCard item={{
      ...item,
      link: 'https://onefootball.com/en/match/2693593',
      title: 'Manchester United vs Manchester City',
      text: '<img src="https://photobooth-api.onefootball.com/kickoff.png">',
    }} />);

    expect(await screen.findByRole('img')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Manchester United vs Manchester City' })).toBeNull();
  });
});

// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getLiquipediaPreview, getPreview, item } from './FeedItemCard.component.testUtils';
import { FeedItemCard } from './FeedItemCard';

describe('FeedItemCard Liquipedia previews', () => {
  it('renders a Liquipedia match summary instead of the generic hero image', async () => {
    getLiquipediaPreview.mockResolvedValue({
      date: 'June 21, 2026 - 10:00 CEST',
      status: 'finished',
      score: ['2', '0'],
      teams: [
        {
          name: 'Team Spirit',
          shortName: 'TSpirit',
          logo: 'https://liquipedia.net/commons/spirit.png',
          results: ['win', 'win', 'default'],
        },
        {
          name: 'VP.Prodigy',
          shortName: 'VP.P',
          logo: 'https://liquipedia.net/commons/vpp.png',
          results: ['loss', 'loss', 'default'],
        },
      ],
      tournament: 'The International 2026: Europe Regional Qualifier',
    });

    render(<FeedItemCard item={{
      ...item,
      link: 'https://liquipedia.net/dota2/Match%3AID_example',
      title: 'Team Spirit vs VP.P',
    }} />);

    expect(await screen.findByLabelText('Team Spirit 2 to 0 VP.Prodigy')).toBeTruthy();
    expect(screen.getByText('The International 2026: Europe Regional Qualifier')).toBeTruthy();
    expect(screen.getAllByLabelText('win')).toHaveLength(2);
    expect(screen.getAllByLabelText('loss')).toHaveLength(2);
    expect(getPreview).not.toHaveBeenCalled();
  });
});

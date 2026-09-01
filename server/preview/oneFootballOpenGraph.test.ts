import { describe, expect, it } from 'vitest';

import { parseOpenGraph } from './openGraphParser.js';

describe('OneFootball Open Graph preview', () => {
  it('extracts the final score from the native match summary', () => {
    const html = `
      <meta property="og:title" content="Barcelona vs Rayo Vallecano - LaLiga">
      <meta property="og:image" content="https://photobooth-api.onefootball.com/stale.png">
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "homeTeam": {
            "@type": "SportsTeam",
            "name": "Barcelona",
            "logo": "https://images.onefootball.com/icons/teams/164/5.png"
          },
          "awayTeam": {
            "@type": "SportsTeam",
            "name": "Rayo Vallecano",
            "logo": "https://images.onefootball.com/icons/teams/164/690.png"
          },
          "startDate": "2026-08-31T19:30:00Z"
        }
      </script>
      <span class="MatchScoreCompetition_competitionName__UzXFd">LaLiga</span>
      <p class="MatchScore_scores__KqpXC title-2-bold-druk">
        <span>5</span><span>:</span><span>2</span>
      </p>
      <span class="title-8-medium">Full time</span>
    `;

    expect(parseOpenGraph(html, new URL('https://onefootball.com/en/match/2700208')))
      .toMatchObject({
        providerData: {
          provider: 'onefootball',
          snapshot: {
            competition: 'LaLiga',
            teams: [
              { name: 'Barcelona', logo: 'https://images.onefootball.com/icons/teams/164/5.png' },
              { name: 'Rayo Vallecano', logo: 'https://images.onefootball.com/icons/teams/164/690.png' },
            ],
            score: ['5', '2'],
            status: 'Full time',
            startsAt: '2026-08-31T19:30:00Z',
          },
        },
      });
  });
});

import { describe, expect, it } from 'vitest';

import { parseLiquipediaMatch } from './liquipediaParser.js';

describe('parseLiquipediaMatch: provider fixture', () => {
  it('extracts the match header, teams, form, score, and tournament', () => {
    const html = `
      <div class="match-bm">
        <div class="match-bm-match-header">
          <div class="match-bm-match-header-date">
            <span>June 21, 2026 - 10:00 <abbr>CEST</abbr></span>
          </div>
          <div class="match-bm-match-header-overview">
            <div class="match-bm-match-header-opponent match-bm-match-header-team">
              <img alt="Team Spirit" src="/commons/spirit-light.png">
              <img alt="Team Spirit" src="/commons/spirit-darkmode.png">
              <div class="match-bm-match-header-team-long"><a>Team Spirit</a></div>
              <div class="match-bm-match-header-team-short"><a>TSpirit</a></div>
              <div class="match-bm-match-header-round-results">
                <div data-label-type="result-win"></div>
                <div data-label-type="result-win"></div>
                <div data-label-type="result-default"></div>
              </div>
            </div>
            <div class="match-bm-match-header-result">2&#160;:&#160;0
              <div class="match-bm-match-header-result-text">finished</div>
            </div>
            <div class="match-bm-match-header-opponent match-bm-match-header-team">
              <img alt="VP.Prodigy" src="/commons/vpp.png">
              <div class="match-bm-match-header-team-long"><a>VP.Prodigy</a></div>
              <div class="match-bm-match-header-team-short"><a>VP.P</a></div>
              <div class="match-bm-match-header-round-results">
                <div data-label-type="result-loss"></div>
                <div data-label-type="result-loss"></div>
                <div data-label-type="result-default"></div>
              </div>
            </div>
          </div>
          <div class="match-bm-match-header-tournament">
            <a>The International 2026: Europe Regional Qualifier</a>
          </div>
        </div>
      </div>
      <div class="toggle-area"></div>
    `;

    expect(parseLiquipediaMatch(html, new URL('https://liquipedia.net/dota2/Match:Example')))
      .toEqual({
        date: 'June 21, 2026 - 10:00 CEST',
        status: 'finished',
        score: ['2', '0'],
        teams: [
          {
            name: 'Team Spirit',
            shortName: 'TSpirit',
            logo: 'https://liquipedia.net/commons/spirit-darkmode.png',
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
  });
});

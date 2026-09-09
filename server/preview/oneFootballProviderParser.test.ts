import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOneFootballProviderData } from './oneFootballProviderParser.js';
import { parseOpenGraph } from './openGraph.js';
import { createBffResultCache } from '../http/bffResultCache.js';

const url = new URL('https://onefootball.com/en/match/2674760');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/onefootball/${name}.html`, import.meta.url), 'utf8');
const active = fixture('first-half');
function withPeriod(period: unknown): string {
  return active.replace(/"period": 4/, `"period": ${JSON.stringify(period)}`);
}

describe('OneFootball structured match state', () => {
  it('extracts the competition name and logo from the matched summary', () => {
    expect(parseOneFootballProviderData(fixture('scheduled'), url)?.snapshot).toMatchObject({
      competition: 'Premier League',
      competitionLogo: 'https://images.onefootball.com/icons/leagueColoredCompetition/128/9.png',
    });
  });

  it.each([
    ['scheduled', 'scheduled'], ['first-half', 'live'], ['full-time', 'over'],
    ['full-time-de', 'over'], ['penalties-ended', 'over'], ['abandoned', null],
  ])('parses captured %s response', (name, expected) => {
    expect(parseOneFootballProviderData(fixture(name!), url)?.snapshot.normalizedStatus).toBe(expected);
  });

  it.each([
    [1, 'scheduled'], [3, 'postponed'], [4, 'live'], [5, 'live'], [7, 'live'],
    [8, 'live'], [9, 'live'], [10, 'live'], [11, 'over'], [12, 'over'], [13, 'over'],
    [0, null], [-1, null], [2, null], [6, null], [99, null], ['4', null], [null, null],
  ])('normalizes provider period %s through Open Graph', (period, expected) => {
    expect(parseOpenGraph(withPeriod(period), url).providerData).toMatchObject({
      provider: 'onefootball', snapshot: { normalizedStatus: expected },
    });
  });

  it('extracts counted goals by scoring team, excluding disallowed goals', () => {
    const teams = parseOneFootballProviderData(fixture('full-time'), url)!.snapshot.teams;
    expect(teams[0].goals).toEqual([
      { scorer: 'Raphinha', minute: "19'", label: null },
      { scorer: 'Lamine Yamal', minute: "21'", label: null },
      { scorer: 'Florian Lejeune', minute: "51'", label: 'Own goal' },
      { scorer: 'Raphinha', minute: "71'", label: null },
      { scorer: 'Lamine Yamal', minute: "90'", label: null },
    ]);
    expect(teams[1].goals).toEqual([
      { scorer: 'Sérgio Camello', minute: "12'", label: null },
      { scorer: 'Sérgio Camello', minute: "59'", label: null },
    ]);
  });

  it('preserves added time and penalty labels, skips missed penalties and malformed goals', () => {
    const html = fixture('full-time')
      .replace('"timeline": "19\'"', '"timeline": "45+2\'"')
      .replace('"type": 1, "scorer"', '"type": 2, "scorer"')
      .replace('"name": "Own goal"', '"name": "Penalty"')
      .replace('"type": 3, "scorer"', '"type": 4, "scorer"')
      .replace('"name": "Lamine Yamal"', '"name": null');
    const goals = parseOneFootballProviderData(html, url)!.snapshot.teams[0].goals!;
    expect(goals).toContainEqual({ scorer: 'Raphinha', minute: "45+2'", label: null });
    expect(goals).toContainEqual({ scorer: 'Florian Lejeune', minute: "51'", label: 'Penalty' });
    expect(goals).toHaveLength(4);
  });

  it('does not use localized display text as a live marker', () => {
    for (const text of ['Live', 'Half time', 'Перерыв', "90+5'", 'Full time']) {
      const html = withPeriod(99).replace(/"timePeriod": "[^"]*"/, `"timePeriod": "${text}"`);
      expect(parseOneFootballProviderData(html, url)?.snapshot.normalizedStatus).toBeNull();
    }
  });

  it('fails closed for missing, malformed, unrelated or ambiguous summaries', () => {
    const script = active.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)![1]!;
    const data = JSON.parse(script);
    data.props.pageProps.containers.push(data.props.pageProps.containers[0]);
    const cases = [
      active.replace(script, JSON.stringify(data)),
      active.replace(/"period": 4,/, ''),
      active.replace('"props":', 'broken:'),
      active.replace('"matchScore":', '"recommendations":'),
      active.replace(/"name": "([^"]+)"(?=, "score")/, '"name": "Other team"'),
      active.replace(/<script id="__NEXT_DATA__"[\s\S]*/, ''),
    ];
    for (const html of cases) {
      expect(parseOpenGraph(`<meta property="og:title" content="Match">${html}`, url)).toMatchObject({
        title: 'Match', providerData: { snapshot: { normalizedStatus: null } },
      });
    }
    expect(parseOpenGraph('<meta property="og:title" content="Match">', url)).toMatchObject({ title: 'Match', providerData: null });
  });

  it('ignores live recommendations elsewhere in an unknown match page', () => {
    const html = withPeriod(99).replace('"containers": [', '"recommendations": [{"period": 4}], "containers": [');
    expect(parseOneFootballProviderData(html, url)?.snapshot.normalizedStatus).toBeNull();
  });

  it('refreshes a live result to over after the 60-second BFF cache expires', async () => {
    let now = 0;
    let html = active;
    const cache = createBffResultCache({ now: () => now });
    const load = () => cache.load(url.href, async () => parseOneFootballProviderData(html, url));
    expect((await load())?.snapshot.normalizedStatus).toBe('live');
    html = withPeriod(11);
    now = 59_999;
    expect((await load())?.snapshot.normalizedStatus).toBe('live');
    now = 60_000;
    expect((await load())?.snapshot.normalizedStatus).toBe('over');
  });
});

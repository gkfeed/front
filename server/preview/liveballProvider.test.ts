import { describe, expect, it } from 'vitest';
import { parseLiveballData } from './providers/liveball.js';
import { isOpenGraphProviderData, getProviderDataImageUrls } from '../../shared/providerData.js';

const url = new URL('https://liveball.sx/match/123');
describe('LiveBall match data', () => {
  it('parses teams, logos, score and kickoff from the match hero', () => {
    const result = parseLiveballData(`<div class="mt-hero" data-live-st="fin">
      <div class="mt-hero__head"><img src="https://cdn.lbs.pw/football/leagues/2.png"><a class="mt-hero__league">Лига</a><time class="mt-hero__date" data-ts="1793822400"></time></div>
      <div class="mt-side--home"><span class="mt-side__name">Лейпциг</span><a class="mt-side__logo"><img src="https://cdn.lbs.pw/football/teams/173.png"></a></div>
      <div class="mt-hero__score">2 : 3</div><div class="mt-hero__status">Матч окончен</div>
      <div class="mt-side--away"><span class="mt-side__name">Сити</span><a class="mt-side__logo"><img src="https://cdn.lbs.pw/football/teams/50.png"></a></div></div>`, url);
    expect(result?.snapshot).toMatchObject({ teams: [{ name: 'Лейпциг', logo: 'https://cdn.lbs.pw/football/teams/173.png' }, { name: 'Сити', logo: 'https://cdn.lbs.pw/football/teams/50.png' }], score: ['2', '3'], normalizedStatus: 'over', startsAt: '2026-11-04T20:00:00.000Z' });
    expect(isOpenGraphProviderData(result)).toBe(true);
    expect(getProviderDataImageUrls(result)).toHaveLength(3);
  });
  it('returns null for missing teams', () => expect(parseLiveballData('<div class="mt-hero"></div>', url)).toBeNull());
});

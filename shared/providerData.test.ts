import { describe, expect, it } from 'vitest';

import { getProviderDataImageUrls, isOpenGraphProviderData } from './providerData.js';
import { hltvProviderDataModule } from './providerData/hltv.js';
import { oneFootballProviderDataModule } from './providerData/oneFootball.js';

describe('provider-data modules', () => {
  it('owns HLTV validation and provider-local image facts', () => {
    const value = {
      provider: 'hltv',
      snapshot: {
        startsAt: null,
        teams: [
          { name: 'Alpha', logo: 'https://cdn.example/alpha.png' },
          { name: 'Bravo', logo: null },
        ],
        status: 'live',
        score: ['1', '0'],
        currentMap: null,
        completedMaps: null,
        playerStats: null,
        teamSides: null,
      },
    };

    expect(hltvProviderDataModule.is(value)).toBe(true);
    expect(isOpenGraphProviderData(value)).toBe(true);
    expect(getProviderDataImageUrls(value)).toEqual(['https://cdn.example/alpha.png']);
  });

  it('owns OneFootball validation without relying on HLTV helpers', () => {
    const value = {
      provider: 'onefootball',
      snapshot: {
        competition: 'LaLiga',
        teams: [
          { name: 'Barcelona', logo: null },
          { name: 'Rayo Vallecano', logo: 'https://cdn.example/rayo.png' },
        ],
        score: ['5', '2'],
        status: 'Full time',
        normalizedStatus: 'over',
        startsAt: '2026-08-31T19:30:00Z',
      },
    };

    expect(oneFootballProviderDataModule.is(value)).toBe(true);
    for (const normalizedStatus of [undefined, 'Full time', 'LIVE', 4]) {
      expect(oneFootballProviderDataModule.is({ ...value, snapshot: { ...value.snapshot, normalizedStatus } })).toBe(false);
    }
    expect(isOpenGraphProviderData(value)).toBe(true);
    expect(getProviderDataImageUrls(value)).toEqual(['https://cdn.example/rayo.png']);
  });

  it('rejects unsupported provider shapes at the serialized boundary', () => {
    expect(isOpenGraphProviderData({ provider: 'unknown', snapshot: {} })).toBe(false);
    expect(isOpenGraphProviderData(undefined)).toBe(false);
    expect(getProviderDataImageUrls(null)).toEqual([]);
  });
});

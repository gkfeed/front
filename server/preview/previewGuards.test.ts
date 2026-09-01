import { describe, expect, it } from 'vitest';

import { isOpenGraphPreview } from '../../shared/previewGuards.js';

const validPreview = {
  url: 'https://example.com/story',
  title: null,
  description: null,
  image: null,
  video: null,
  siteName: null,
  type: null,
  providerData: null,
};

describe('isOpenGraphPreview', () => {
  it('rejects lookalike values instead of coercing external fields', () => {
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: { provider: 'hltv', snapshot: { ...validSnapshot, status: ['live'] } },
    })).toBe(false);
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: { provider: 'hltv', snapshot: { ...validSnapshot, status: { toString: () => 'live' } } },
    })).toBe(false);
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: { provider: 'hltv', snapshot: { ...validSnapshot, score: ['1', 0] } },
    })).toBe(false);
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: {
        provider: 'hltv',
        snapshot: { ...validSnapshot, roundHistory: [{ round: 1, teamIndex: 2, outcome: 'ct_win' }] },
      },
    })).toBe(false);
    expect(isOpenGraphPreview({ ...validPreview, providerData: undefined })).toBe(false);
  });

  it('accepts the supported provider snapshot after runtime validation', () => {
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: {
        provider: 'hltv',
        snapshot: {
          ...validSnapshot,
          status: 'live',
          score: ['1', '0'],
          teams: [{ name: 'A', logo: null }, { name: 'B', logo: 'https://cdn.example/b.png' }],
        },
      },
    })).toBe(true);
  });

  it('accepts a validated OneFootball match snapshot', () => {
    expect(isOpenGraphPreview({
      ...validPreview,
      providerData: {
        provider: 'onefootball',
        snapshot: {
          competition: 'LaLiga',
          teams: [{ name: 'Barcelona', logo: null }, { name: 'Rayo Vallecano', logo: null }],
          score: ['5', '2'],
          status: 'Full time',
          startsAt: '2026-08-31T19:30:00Z',
        },
      },
    })).toBe(true);
  });
});

const validSnapshot = {
  startsAt: null,
  teams: null,
  status: null,
  score: null,
  currentMap: null,
  completedMaps: null,
  playerStats: null,
  teamSides: null,
};

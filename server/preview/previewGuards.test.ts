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
};

describe('isOpenGraphPreview', () => {
  it('rejects lookalike values instead of coercing external fields', () => {
    expect(isOpenGraphPreview({ ...validPreview, matchStatus: ['live'] })).toBe(false);
    expect(isOpenGraphPreview({ ...validPreview, matchStatus: { toString: () => 'live' } })).toBe(false);
    expect(isOpenGraphPreview({ ...validPreview, matchScore: ['1', 0] })).toBe(false);
  });

  it('accepts the supported optional match fields after runtime validation', () => {
    expect(isOpenGraphPreview({
      ...validPreview,
      matchStatus: 'live',
      matchScore: ['1', '0'],
      matchTeams: [{ name: 'A', logo: null }, { name: 'B', logo: 'https://cdn.example/b.png' }],
    })).toBe(true);
  });
});

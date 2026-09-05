import { describe, expect, it } from 'vitest';

import { parseHltvLiveIndex } from './hltvLiveIndex.js';

describe('HLTV live index', () => {
  it('returns only live match IDs and removes duplicates', () => {
    const html = `
      <div class="match-wrapper live-match-container" data-match-id="2396948" live="true"></div>
      <div data-match-id="2397003" class="match-wrapper" live="false"></div>
      <div live="true" data-match-id="2396948"></div>
      <div live="true" data-match-id="2397256"></div>
    `;

    expect(parseHltvLiveIndex(html)).toEqual({ eventIds: ['2396948', '2397256'] });
  });
});

import { describe, expect, it } from 'vitest';

import {
  formatHltvCountdown,
  getHltvMapScoreClass,
  isCompletedHltvMapScore,
} from './hltvPresentation';

describe('HLTV presentation helpers', () => {
  it('formats countdowns with days when needed', () => {
    expect(formatHltvCountdown(90_001)).toBe('00:01:31');
    expect(formatHltvCountdown(86_400_000 + 3_661_000)).toBe('1d 01:01:01');
  });

  it('recognizes completed map scores and marks the winner', () => {
    expect(isCompletedHltvMapScore(['13', '7'])).toBe(true);
    expect(isCompletedHltvMapScore(['12', '10'])).toBe(false);
    expect(getHltvMapScoreClass(['13', '7'], 0, null)).toContain('winner');
    expect(getHltvMapScoreClass(['13', '7'], 1, null)).toContain('loser');
  });
});

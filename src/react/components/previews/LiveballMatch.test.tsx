// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveballMatch } from './LiveballMatch';
import { parseLiveballMatch } from '../../domain/liveballMatch';
import { item } from '../FeedItemCard.component.testUtils';

describe('LiveBall match preview', () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const matchItem = { ...item, link: 'https://liveball.sx/match/1635710', title: 'РБ Лейпциг vs Манчестер Сити - Лига Чемпионов · Общий этап, 4 тур' };
  it('renders the teams and competition with a link to the match', () => {
    const match = parseLiveballMatch(matchItem);
    expect(match).not.toBeNull();
    render(<LiveballMatch item={matchItem} match={match!} />);
    expect(screen.getByText('РБ Лейпциг')).toBeTruthy();
    expect(screen.getByText('Манчестер Сити')).toBeTruthy();
    expect(screen.getByText('Лига Чемпионов · Общий этап, 4 тур')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(matchItem.link);
  });
  it('counts down to kickoff and hides the stale provider countdown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-15T19:44:58Z'));
    const match = parseLiveballMatch(matchItem)!;
    render(<LiveballMatch item={matchItem} match={match} snapshot={{
      teams: [{ name: match.home, logo: null }, { name: match.away, logo: null }],
      competition: null, competitionLogo: null, startsAt: '2026-11-15T19:45:00Z',
      score: ['22', '45'], status: 'До матча:00 : 00 : 00', normalizedStatus: null,
    }} />);
    expect(screen.getByText('Starts in 00:00:02')).toBeTruthy();
    expect(screen.queryByText('22 : 45')).toBeNull();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.getByText('Starts in 00:00:01')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(screen.queryByText(/Starts in/)).toBeNull();
  });
  it('falls back for unrelated URLs and titles', () => {
    expect(parseLiveballMatch({ ...matchItem, link: 'https://liveball.sx.evil.test/match/1' })).toBeNull();
    expect(parseLiveballMatch({ ...matchItem, title: 'Match announcement' })).toBeNull();
  });
});

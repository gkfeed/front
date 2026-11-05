// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveballMatch } from './LiveballMatch';
import { parseLiveballMatch } from '../../domain/liveballMatch';
import { item } from '../FeedItemCard.component.testUtils';

describe('LiveBall match preview', () => {
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
  it('falls back for unrelated URLs and titles', () => {
    expect(parseLiveballMatch({ ...matchItem, link: 'https://liveball.sx.evil.test/match/1' })).toBeNull();
    expect(parseLiveballMatch({ ...matchItem, title: 'Match announcement' })).toBeNull();
  });
});

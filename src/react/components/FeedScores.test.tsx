// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFeedRecommendationScores, type FeedScoresResponse } from '../services/feedRecommendationScores';
import { FeedScores } from './FeedScores';

vi.mock('../services/feedRecommendationScores');
vi.mock('../telemetry/recommendationSubject', () => ({ getRecommendationSubjectId: () => 'reader' }));
vi.mock('../state/useAuth', () => ({ useAuth: () => ({ credentials: { username: 'reader' } }) }));
const feeds = [
  { id: 1, title: 'Alpha', type: 'rss', url: 'https://example.com/a' },
  { id: 2, title: 'Beta', type: 'rss', url: 'https://example.com/b' },
];
const data: FeedScoresResponse = { classificationVersion: 1, viewedThresholdMs: 10000, feeds: [
  { subjectId: 'reader', feedId: 1, itemCount: 10, category: 'keep_for_later',
    counts: { keep_for_later: 6, delete_immediately: 3, delete_after_viewing: 1 },
    probabilities: { keep_for_later: .6, delete_immediately: .3, delete_after_viewing: .1 } },
  { subjectId: 'reader', feedId: 2, itemCount: 5, category: 'delete_after_viewing',
    counts: { keep_for_later: 0, delete_immediately: 1, delete_after_viewing: 4 },
    probabilities: { keep_for_later: 0, delete_immediately: .2, delete_after_viewing: .8 } },
] };
const renderScores = () => render(<MemoryRouter><FeedScores feeds={feeds} /></MemoryRouter>);
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('feed score visualization', () => {
  it('shows named distributions and sample counts, and filters and sorts without refetching', async () => {
    vi.mocked(getFeedRecommendationScores).mockResolvedValue(data);
    renderScores();
    expect(screen.getByRole('status').textContent).toContain('Loading');
    expect(await screen.findByRole('img', { name: 'Alpha: keep for later 60%, delete immediately 30%, after viewing 10%' })).toBeTruthy();
    expect(screen.getByText('2 feeds · 15 reviewed items')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort scores' }), { target: { value: 'viewed' } });
    expect(screen.getByRole('list').firstElementChild?.textContent).toContain('Beta');
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a feed' }), { target: { value: 'Alpha' } });
    expect(screen.queryByRole('link', { name: 'Beta' })).toBeNull();
    expect(getFeedRecommendationScores).toHaveBeenCalledOnce();
  });

  it('shows an actionable empty state without made-up scores', async () => {
    vi.mocked(getFeedRecommendationScores).mockResolvedValue({ ...data, feeds: [] });
    renderScores();
    expect(await screen.findByText('No observations yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open reader' }).getAttribute('href')).toBe('/reader?view=review');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('allows refreshing after a failed score request', async () => {
    vi.mocked(getFeedRecommendationScores).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(data);
    renderScores();
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(screen.getByRole('link', { name: 'Alpha' })).toBeTruthy());
    expect(getFeedRecommendationScores).toHaveBeenCalledTimes(2);
  });
});

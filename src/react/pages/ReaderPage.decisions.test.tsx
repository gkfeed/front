// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { classifyRecommendationEvent } from '../../../shared/recommendationScoring';
import { enqueueRecommendationEvent } from '../telemetry/recommendationQueue';
import { getFeedDecisionsStorageKey } from '../state/useFeedDecisions';
import { deleteFeedItemById, getAllFeeds, getFeedItems } from '../services/feeds';
import { stubLocalStorage } from '../testUtils';
import { READER_ITEMS as ITEMS, resetReaderPageTest } from './ReaderPage.test.utils';
import { ReaderPage } from './ReaderPage';

vi.mock('../services/feeds');
vi.mock('../telemetry/recommendationQueue', () => ({
  enqueueRecommendationEvent: vi.fn(), startRecommendationDelivery: vi.fn(),
}));
vi.mock('../state/useAuth', () => {
  const auth = { credentials: { username: 'reader', password: 'secret' } };
  return { useAuth: () => auth };
});

beforeEach(stubLocalStorage);

afterEach(() => {
  resetReaderPageTest();
});

describe('ReaderPage decisions', () => {
  it.each([
    { type: 'rezka', grouped: true },
    { type: 'rezka:collection', grouped: false },
    { type: 'web', grouped: false },
  ])('keeps $type entries using the actual feed type', async ({ type, grouped }) => {
    vi.mocked(getAllFeeds).mockResolvedValue([
      { id: 5, title: 'Series', type, url: 'https://hdrezka.me/series/story.html' },
      { id: 6, title: 'Other series', type: 'rezka', url: 'https://hdrezka.me/series/other.html' },
    ]);
    vi.mocked(getFeedItems).mockResolvedValue([
      { id: 14, feedId: 5, link: 'https://hdrezka.me/series/story.html?episode=1', title: 'Episode one', text: '' },
      { id: 13, feedId: 5, link: 'https://hdrezka.me/series/story.html?episode=2', title: 'Episode two', text: '' },
      { id: 12, feedId: 6, link: 'https://example.com/other', title: 'Other series', text: '' },
    ]);
    renderReaderPage();

    expect(await screen.findByText('Episode one')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText('Other series')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /keep/i }));
    expect(await screen.findByText(grouped ? 'Episode one' : 'Episode two')).toBeTruthy();
    if (grouped) {
      expect(screen.queryByText('Episode two')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /keep/i }));
      expect(await screen.findByText('Other series')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /keep/i }));
      expect(await screen.findByText('You’ve reviewed everything')).toBeTruthy();
      expect(deleteFeedItemById).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Reset kept items' }));
      expect(await screen.findByText('Episode one')).toBeTruthy();
    }
  });

  it('waits for feed types before allowing Keep and retries a failed type lookup', async () => {
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    vi.mocked(getAllFeeds).mockRejectedValueOnce(new Error('Unable to load feed types')).mockResolvedValueOnce([]);
    renderReaderPage();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /keep/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('First story')).toBeTruthy();
  });

  it.each([
    { action: 'keep', kept: true, deleteCalls: 0, activeMs: 10000, category: 'keep_for_later', key: 'a' },
    { action: 'delete', kept: false, deleteCalls: 1, activeMs: 9999, category: 'delete_immediately', key: 'd' },
    { action: 'delete', kept: false, deleteCalls: 1, activeMs: 10000, category: 'delete_after_viewing', key: null },
  ])('records $category at $activeMs ms for the signed-in user', async ({ action, kept, deleteCalls, activeMs, category, key }) => {
    const storage = stubLocalStorage();
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.mocked(deleteFeedItemById).mockResolvedValue();
    vi.mocked(getFeedItems).mockResolvedValue(ITEMS);
    render(
      <MemoryRouter initialEntries={['/reader']}>
        <ReaderPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('First story')).toBeTruthy();
    clock.mockReturnValue(activeMs);
    if (key) fireEvent.keyDown(window, { key });
    else fireEvent.click(screen.getByRole('button', { name: new RegExp(action, 'i') }));

    const decisionsKey = getFeedDecisionsStorageKey('reader');
    await waitFor(() => expect(JSON.parse(storage.get(decisionsKey) ?? '[]')).toEqual([
      { itemId: 11, feedId: 2, kept, activeMs, decidedAt: expect.any(Number) },
    ]));
    expect(vi.mocked(deleteFeedItemById)).toHaveBeenCalledTimes(deleteCalls);
    const recorded = vi.mocked(enqueueRecommendationEvent).mock.calls.at(-1)![0];
    expect(recorded).toMatchObject({ action, activeMs, item: { id: 11, feedId: 2 } });
    expect(classifyRecommendationEvent(recorded)).toBe(category);
  });
});

function renderReaderPage() {
  return render(<MemoryRouter initialEntries={['/reader']}><ReaderPage /></MemoryRouter>);
}

// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { enqueueRecommendationEvent } from './recommendationQueue';
import { useReviewObservation } from './useReviewObservation';

vi.mock('../state/useAuth', () => ({ useAuth: () => ({ credentials: { username: 'reader' } }) }));
vi.mock('./recommendationQueue', () => ({
  enqueueRecommendationEvent: vi.fn(), startRecommendationDelivery: vi.fn(),
}));
const item = { id: 1, feedId: 2, title: 'Card', text: '', link: 'https://example.com' };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const events = () => vi.mocked(enqueueRecommendationEvent).mock.calls.map(([event]) => event);

describe('review decision lifecycle', () => {
  it('records a single decision in StrictMode without logging separate view events', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useReviewObservation(item), { wrapper });
    expect(events()).toEqual([]);
    await act(async () => { result.current('keep'); result.current('delete'); });
    expect(events()).toMatchObject([{ action: 'keep', item: { id: 1 } }]);
  });

  it('does not log scroll mode or split timing on snapshot refresh', async () => {
    const { result, rerender } = renderHook(({ current }) => useReviewObservation(current), {
      initialProps: { current: undefined as typeof item | undefined },
    });
    expect(result.current('delete')).toBeNull();
    rerender({ current: item });
    rerender({ current: { ...item, title: 'Updated' } });
    await act(async () => { result.current('delete'); });
    expect(events()).toHaveLength(1);
    rerender({ current: undefined });
    expect(result.current('delete')).toBeNull();
    expect(events()).toHaveLength(1);
  });
});

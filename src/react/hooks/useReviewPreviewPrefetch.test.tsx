// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeatureUseCases } from '../application/featureComposition';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import type { FeedItem } from '../types';
import {
  REVIEW_PREVIEW_PREFETCH_COUNT,
  useReviewPreviewPrefetch,
} from './useReviewPreviewPrefetch';

const EMPTY_REMOTE_PREVIEW = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

afterEach(() => vi.restoreAllMocks());

describe('useReviewPreviewPrefetch', () => {
  it('prefetches only the next few remote previews in queue order', async () => {
    const loadRemotePreview = vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW);
    const items = [1, 2, 3, 4, 5].map((id) => createItem(id));

    renderHook(() => useReviewPreviewPrefetch({
      enabled: true,
      items,
      activeReviewIds: items.map((item) => item.id),
    }), { wrapper: createWrapper(loadRemotePreview) });

    await waitFor(() => expect(loadRemotePreview).toHaveBeenCalledTimes(REVIEW_PREVIEW_PREFETCH_COUNT));
    expect(loadRemotePreview.mock.calls.map(([url]) => url)).toEqual(
      items.slice(1, REVIEW_PREVIEW_PREFETCH_COUNT + 1).map((item) => item.link),
    );
  });

  it('does not prefetch while disabled', async () => {
    const loadRemotePreview = vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW);
    const items = [createItem(1), createItem(2)];

    renderHook(() => useReviewPreviewPrefetch({
      enabled: false,
      items,
      activeReviewIds: items.map((item) => item.id),
    }), { wrapper: createWrapper(loadRemotePreview) });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(loadRemotePreview).not.toHaveBeenCalled();
  });

  it('aborts pending prefetches when navigation changes and on unmount', async () => {
    const signals: AbortSignal[] = [];
    const loadRemotePreview = vi.fn((
      _url: string,
      _isLiquipedia: boolean,
      signal: AbortSignal,
    ) => {
      signals.push(signal);
      return new Promise<typeof EMPTY_REMOTE_PREVIEW>(() => undefined);
    });
    const items = [1, 2, 3, 4].map((id) => createItem(id));
    const { rerender, unmount } = renderHook(
      ({ activeReviewIds }: { activeReviewIds: number[] }) => useReviewPreviewPrefetch({
        enabled: true,
        items,
        activeReviewIds,
      }),
      {
        initialProps: { activeReviewIds: [1, 2] },
        wrapper: createWrapper(loadRemotePreview),
      },
    );

    await waitFor(() => expect(signals).toHaveLength(1));
    const firstSignal = signals[0]!;
    rerender({ activeReviewIds: [3, 4] });
    await waitFor(() => expect(signals).toHaveLength(2));

    expect(firstSignal.aborted).toBe(true);
    const secondSignal = signals[1]!;
    unmount();
    expect(secondSignal.aborted).toBe(true);
  });
});

function createWrapper(loadRemotePreview: ReturnType<typeof vi.fn>) {
  const useCases = {
    preview: { loadRemotePreview },
  } as unknown as FeatureUseCases;

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <FeatureUseCasesContext value={useCases}>
        {children}
      </FeatureUseCasesContext>
    );
  };
}

function createItem(id: number): FeedItem {
  return {
    id,
    feedId: id,
    link: `https://example.com/story-${id}`,
    title: `Story ${id}`,
    text: '',
  };
}

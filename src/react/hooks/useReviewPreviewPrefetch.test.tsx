// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FeatureUseCases } from '../application/featureComposition';
import { FeatureUseCasesContext } from '../state/featureUseCasesContext';
import type { FeedItem } from '../types';
import { PluginPreferencesProvider } from '../state/PluginPreferencesProvider';
import { usePluginPreferences } from '../state/usePluginPreferences';
import { restoreLocalStorage, stubLocalStorage } from '../testUtils';
import {
  REVIEW_PREVIEW_PREFETCH_COUNT,
  useReviewPreviewPrefetch,
} from './useReviewPreviewPrefetch';

const EMPTY_REMOTE_PREVIEW = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

afterEach(() => {
  vi.restoreAllMocks();
  restoreLocalStorage();
});

describe('useReviewPreviewPrefetch', () => {
  it('aborts pending work on plugin policy changes, even if the fallback uses the same source', async () => {
    stubLocalStorage();
    const loadRemotePreview = vi.fn<(url: string, source: string, signal: AbortSignal) => Promise<typeof EMPTY_REMOTE_PREVIEW>>(() => new Promise(() => {}));
    const items = [createItem(1), { ...createItem(2), link: 'https://www.hltv.org/matches/123/example' }];
    const Wrapper = createWrapper(loadRemotePreview);
    const { result } = renderHook(() => {
      useReviewPreviewPrefetch({ enabled: true, items, activeReviewIds: [1, 2] });
      return usePluginPreferences();
    }, { wrapper: ({ children }) => <Wrapper><PluginPreferencesProvider>{children}</PluginPreferencesProvider></Wrapper> });

    await waitFor(() => expect(loadRemotePreview).toHaveBeenCalledOnce());
    const firstSignal = loadRemotePreview.mock.calls[0]![2] as AbortSignal;
    act(() => result.current.setPluginEnabled('hltv', false));
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => expect(loadRemotePreview).toHaveBeenCalledTimes(2));
    expect((loadRemotePreview.mock.calls[1]![2] as AbortSignal).aborted).toBe(false);
  });
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

  it('aborts skipped prefetches on navigation and remaining ones on unmount', async () => {
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
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(true);
  });

  it('does not resubscribe to an overlapping pending prefetch after navigation', async () => {
    const loadRemotePreview = vi.fn(() => (
      new Promise<typeof EMPTY_REMOTE_PREVIEW>(() => undefined)
    ));
    const items = [1, 2, 3].map((id) => createItem(id));
    const { rerender } = renderHook(
      ({ activeReviewIds }: { activeReviewIds: number[] }) => useReviewPreviewPrefetch({
        enabled: true,
        items,
        activeReviewIds,
      }),
      {
        initialProps: { activeReviewIds: [1, 2, 3] },
        wrapper: createWrapper(loadRemotePreview),
      },
    );

    await waitFor(() => expect(loadRemotePreview).toHaveBeenCalledTimes(2));
    rerender({ activeReviewIds: [2, 3] });
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(loadRemotePreview).toHaveBeenCalledTimes(2);
  });

  it('bounds pending work during rapid navigation and releases it when review finishes', async () => {
    const signals: AbortSignal[] = [];
    const loadRemotePreview = vi.fn((_url: string, _source: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<typeof EMPTY_REMOTE_PREVIEW>(() => undefined);
    });
    const items = Array.from({ length: 20 }, (_, index) => createItem(index + 1));
    const ids = items.map((item) => item.id);
    const { rerender } = renderHook(
      ({ activeReviewIds }: { activeReviewIds: number[] }) => useReviewPreviewPrefetch({
        enabled: true,
        items,
        activeReviewIds,
      }),
      { initialProps: { activeReviewIds: ids }, wrapper: createWrapper(loadRemotePreview) },
    );

    for (let index = 0; index < ids.length; index += 1) {
      rerender({ activeReviewIds: ids.slice(index) });
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      expect(signals.filter((signal) => !signal.aborted).length)
        .toBeLessThanOrEqual(REVIEW_PREVIEW_PREFETCH_COUNT + 1);
    }

    expect(loadRemotePreview).toHaveBeenCalledTimes(items.length - 1);
    rerender({ activeReviewIds: [] });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
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

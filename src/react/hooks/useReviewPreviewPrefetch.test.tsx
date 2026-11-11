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

  it('buffers the next story and a candidate from another source, keeping overlapping work', async () => {
    const createElement = vi.spyOn(document, 'createElement');
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const loadRemotePreview = vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW);
    const items = [1, 2, 3, 4, 5].map((id) => ({
      ...createItem(id), feedId: id < 4 ? 1 : id === 4 ? 2 : 3,
      title: 'inst: author', link: `https://tempfile.org/${id}/download`,
    }));
    const { rerender } = renderHook(({ enabled, ids, feedItems }) => useReviewPreviewPrefetch({
      enabled, items: feedItems, activeReviewIds: ids,
    }), { initialProps: { enabled: true, ids: [1, 2, 3, 4, 5], feedItems: items }, wrapper: createWrapper(loadRemotePreview) });

    const videos = () => createElement.mock.results
      .map((result) => result.value as HTMLElement)
      .filter((element) => element.tagName === 'VIDEO') as HTMLVideoElement[];
    await waitFor(() => expect(videos()).toHaveLength(2));
    expect(videos().map((video) => video.src)).toEqual([items[1]!.link, items[3]!.link]);
    const nextSource = videos()[1]!;
    rerender({ enabled: true, ids: [2, 4, 3, 5], feedItems: items.map((item) => ({ ...item })) });
    await waitFor(() => expect(videos()).toHaveLength(3));
    expect(nextSource.src).toBe(items[3]!.link);
    expect(videos()[0]!.hasAttribute('src')).toBe(false);
    expect(videos()[2]!.src).toBe(items[2]!.link);
    rerender({ enabled: false, ids: [2, 4, 3, 5], feedItems: items });
    expect(videos().every((video) => !video.hasAttribute('src'))).toBe(true);
  });

  it('keeps video buffering bounded when a large queue changes order', async () => {
    const createElement = vi.spyOn(document, 'createElement');
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const items = Array.from({ length: 1200 }, (_, index) => ({
      ...createItem(index + 1), feedId: index === 899 ? 2 : 1,
      title: 'inst: author', link: `https://tempfile.org/${index + 1}/download`,
    }));
    const ids = items.map(({ id }) => id);
    const { rerender } = renderHook(({ activeReviewIds }) => useReviewPreviewPrefetch({
      enabled: true, items, activeReviewIds,
    }), { initialProps: { activeReviewIds: ids }, wrapper: createWrapper(vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW)) });
    const videos = () => createElement.mock.results
      .map((result) => result.value as HTMLElement)
      .filter((element) => element.tagName === 'VIDEO') as HTMLVideoElement[];
    await waitFor(() => expect(videos()).toHaveLength(2));
    expect(videos().map((video) => video.src)).toEqual([items[1]!.link, items[2]!.link]);
    rerender({ activeReviewIds: [1, 2, 900, ...ids.filter((id) => id > 2 && id !== 900)] });
    await waitFor(() => expect(videos()).toHaveLength(3));
    expect(videos()[0]!.src).toBe(items[1]!.link);
    expect(videos()[1]!.hasAttribute('src')).toBe(false);
    expect(videos()[2]!.src).toBe(items[899]!.link);
  });

  it('releases buffered stories when the Instagram plugin is disabled', async () => {
    stubLocalStorage();
    const createElement = vi.spyOn(document, 'createElement');
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const items = [1, 2].map((id) => ({
      ...createItem(id), title: 'inst: author', link: `https://tempfile.org/${id}/download`,
    }));
    const Wrapper = createWrapper(vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW));
    const { result } = renderHook(() => {
      useReviewPreviewPrefetch({ enabled: true, items, activeReviewIds: [1, 2] });
      return usePluginPreferences();
    }, { wrapper: ({ children }) => <Wrapper><PluginPreferencesProvider>{children}</PluginPreferencesProvider></Wrapper> });
    await waitFor(() => expect(createElement.mock.results.some((entry) => (entry.value as HTMLElement).tagName === 'VIDEO')).toBe(true));
    const video = createElement.mock.results.find((entry) => (entry.value as HTMLElement).tagName === 'VIDEO')!.value as HTMLVideoElement;
    act(() => result.current.setPluginEnabled('instagram', false));
    expect(video.hasAttribute('src')).toBe(false);
  });

  it('prefetches only the next few remote previews in queue order', async () => {
    const loadRemotePreview = vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW);
    const items = Array.from({ length: 13 }, (_, index) => createItem(index + 1));

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

  it('aborts displaced prefetches and releases remaining work on unmount', async () => {
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
    expect(firstSignal.aborted).toBe(true);
    await waitFor(() => expect(signals).toHaveLength(2));
    const secondSignal = signals[1]!;
    unmount();
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(true);
  });

  it('updates queued priorities before cancelling a displaced request', async () => {
    const events: string[] = [];
    const load = vi.fn((_url: string, _source: string, signal: AbortSignal) => {
      signal.addEventListener('abort', () => events.push('abort'));
      return new Promise<typeof EMPTY_REMOTE_PREVIEW>(() => undefined);
    });
    const reprioritize = vi.fn((url: string, source: string, priority: number) => {
      events.push(`${source}:${url}:${priority}`);
    });
    const items = Array.from({ length: 13 }, (_, index) => createItem(index + 1));
    const { rerender } = renderHook(
      ({ activeReviewIds }: { activeReviewIds: number[] }) => useReviewPreviewPrefetch({ enabled: true, items, activeReviewIds }),
      { initialProps: { activeReviewIds: items.map(({ id }) => id) }, wrapper: createWrapper(load, reprioritize) },
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(10));
    events.length = 0;
    rerender({ activeReviewIds: [1, 10, 11, 12, 13] });
    const priorityIndex = events.indexOf(`open-graph:${items[9]!.link}:1`);
    expect(priorityIndex).toBeGreaterThanOrEqual(0);
    expect(events.indexOf('abort')).toBeGreaterThan(priorityIndex);
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
      await new Promise((resolve) => window.setTimeout(resolve, 20));
      expect(signals.filter((signal) => !signal.aborted).length)
        .toBeLessThanOrEqual(REVIEW_PREVIEW_PREFETCH_COUNT + 1);
    }

    expect(loadRemotePreview).toHaveBeenCalledTimes(items.length - 1);
    rerender({ activeReviewIds: [] });
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});

function createWrapper(loadRemotePreview: ReturnType<typeof vi.fn>, reprioritizeRemotePreview?: ReturnType<typeof vi.fn>) {
  const useCases = {
    preview: { loadRemotePreview, reprioritizeRemotePreview },
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

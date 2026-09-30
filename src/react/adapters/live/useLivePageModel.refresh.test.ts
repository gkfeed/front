// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../i18n';
import { getAllFeeds, getFeedItems } from '../../services/feeds';
import { readLiveCandidateCatalog, writeLiveCandidateCatalog } from '../../services/liveCandidateCatalog';
import type { LiveProviderRuntime } from '../../domain/liveEvents';
import { useLivePageModel } from './useLivePageModel';

vi.mock('../../services/feeds');
vi.mock('../../services/liveCandidateCatalog');
vi.mock('../../state/useAuth', () => {
  const credentials = { username: 'reader', password: 'secret' };
  return { useAuth: () => ({ credentials }) };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('Live refresh failures', () => {
  it.each(['failed checks', 'rejected batch'])('checks every dormant candidate despite %s', async (failure) => {
    vi.useFakeTimers();
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: index + 1, feedId: 1, link: `https://example.com/${index + 1}`, title: String(index + 1), text: '',
    }));
    vi.mocked(readLiveCandidateCatalog).mockResolvedValue(undefined);
    vi.mocked(writeLiveCandidateCatalog).mockResolvedValue();
    vi.mocked(getFeedItems).mockResolvedValue(items);
    vi.mocked(getAllFeeds).mockResolvedValue([{ id: 1, title: 'Feed', type: 'rss', url: 'https://example.com' }]);
    const check = vi.fn<LiveProviderRuntime['check']>(async (candidates) => {
      if (failure === 'rejected batch') throw new Error('Offline');
      return { updates: [], failures: candidates.length };
    });
    const provider: LiveProviderRuntime = {
      id: 'test',
      category: { id: 'test', titleKey: 'live.streams', order: 1, layout: 'grid' },
      strategy: 'round-robin',
      refreshIntervalMs: 60_000,
      dormantSweepCycles: 5,
      preserveEndedPlayback: false,
      recognize: (item, feedOrder) => ({
        key: `test:${item.id}`, providerId: 'test', eventId: String(item.id),
        deduplicationKey: `test:${item.id}`, item, feedOrder,
      }),
      check,
    };
    const providers = [provider];
    const { result } = renderHook(() => useLivePageModel(i18n.t, providers));
    await act(async () => {});
    expect(check).toHaveBeenCalledOnce();

    for (let cycle = 1; cycle < 5; cycle++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    }

    expect(check).toHaveBeenCalledTimes(5);
    const attemptedKeys = check.mock.calls.flatMap(([candidates]) => candidates.map(({ key }) => key));
    expect(new Set(attemptedKeys).size).toBe(10);
    expect(result.current.sections[0]?.events).toEqual([]);
    expect(result.current.sections[0]?.state).toBe('error');
  });
});

// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveCandidate, LiveCheckBatch, LiveProviderRuntime } from '../../domain/liveEvents';
import { getAllFeeds, getFeedItems } from '../../services/feeds';
import { readLiveCandidateCatalog, writeLiveCandidateCatalog } from '../../services/liveCandidateCatalog';
import { useLivePageModel } from './useLivePageModel';

vi.mock('../../services/feeds', () => ({ getFeedItems: vi.fn(), getAllFeeds: vi.fn() }));
vi.mock('../../services/liveCandidateCatalog', () => ({ readLiveCandidateCatalog: vi.fn(), writeLiveCandidateCatalog: vi.fn() }));
const credentials = { username: 'user', password: 'secret' };
vi.mock('../../state/useAuth', () => ({ useAuth: () => ({ credentials }) }));
const t = ((key: string) => key) as TFunction;
const item = { id: 100, feedId: 1, link: 'https://example.com/event', title: 'Event', text: '' };
const candidate: LiveCandidate = { key: 'test:1', providerId: 'test', eventId: '1', deduplicationKey: 'test:1', feedOrder: 0, item };
const check = vi.fn<LiveProviderRuntime['check']>();
const provider: LiveProviderRuntime = {
  id: 'test', category: { id: 'test', titleKey: 'test', order: 1, layout: 'list' },
  strategy: 'live-index', refreshIntervalMs: 60_000, dormantSweepCycles: 1, preserveEndedPlayback: false,
  recognize: () => candidate, check,
};
const enabled = [provider];
const disabled: LiveProviderRuntime[] = [];

beforeEach(() => {
  vi.mocked(getAllFeeds).mockResolvedValue([{ id: 1, title: 'Test', type: 'rss', url: 'https://example.com/feed' }]);
  vi.mocked(readLiveCandidateCatalog).mockResolvedValue({
    candidates: [candidate], newestItemId: item.id, lastReconciledAt: Date.now(), providerIds: ['test'],
  });
  vi.mocked(writeLiveCandidateCatalog).mockResolvedValue();
  vi.mocked(getFeedItems).mockResolvedValue([item]);
  check.mockResolvedValue({ updates: [], failures: 0 });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Live plugin lifecycle', () => {
  it('retains active events belonging to providers that stay enabled', async () => {
    check.mockResolvedValue({ failures: 0, updates: [{ key: candidate.key, status: 'live', data: { kind: 'twitch', channel: 'active', title: 'Active' } }] });
    const other: LiveProviderRuntime = { ...provider, id: 'other', recognize: () => null };
    const { result, rerender } = renderHook(({ providers }) => useLivePageModel(t, providers), {
      initialProps: { providers: [provider, other] },
    });
    await waitFor(() => expect(result.current.sections.flatMap((section) => section.events)).toHaveLength(1));
    rerender({ providers: enabled });
    expect(result.current.sections.flatMap((section) => section.events)).toHaveLength(1);
    expect(result.current.sections[0]!.events[0]!.data.kind).toBe('twitch');
  });
  it('aborts manual refresh on unmount instead of creating an orphan signal', async () => {
    const { result, unmount } = renderHook(() => useLivePageModel(t, enabled));
    await waitFor(() => expect(result.current.scanComplete && !result.current.refreshing).toBe(true));
    let resolve!: (batch: LiveCheckBatch) => void;
    check.mockImplementation(() => new Promise((done) => { resolve = done; }));
    act(() => result.current.refresh());
    expect(result.current.refreshing).toBe(true);
    await waitFor(() => expect(resolve).toBeDefined());
    const signal = check.mock.lastCall![1];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ updates: [], failures: 0 }));
  });

  it('starts a new generation without waiting for a non-cooperative disabled provider', async () => {
    let resolveOld!: (batch: LiveCheckBatch) => void;
    check.mockImplementationOnce(() => new Promise((done) => { resolveOld = done; }));
    const { result, rerender } = renderHook(({ providers }) => useLivePageModel(t, providers), {
      initialProps: { providers: enabled },
    });
    await waitFor(() => expect(result.current.scanComplete).toBe(true));
    const oldSignal = check.mock.calls[0]![1];
    rerender({ providers: disabled });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.sections).toHaveLength(0);
    rerender({ providers: enabled });
    await waitFor(() => expect(check.mock.calls.some((call) => call[1] !== oldSignal)).toBe(true));
    await act(async () => resolveOld({
      failures: 0,
      updates: [{ key: candidate.key, status: 'live', data: { kind: 'twitch', channel: 'stale', title: 'Stale event' } }],
    }));
    expect(result.current.sections.flatMap((section) => section.events)).toHaveLength(0);
  });

  it.each([undefined, []])('rescans history when cache coverage excludes a re-enabled provider (%s)', async (providerIds) => {
    vi.mocked(readLiveCandidateCatalog).mockResolvedValue({
      candidates: [], newestItemId: item.id, lastReconciledAt: Date.now(), providerIds,
    });
    const continueScanning = vi.fn();
    vi.mocked(getFeedItems).mockImplementation(async (_credentials, _limit, _signal, onProgress) => {
      continueScanning(onProgress?.([item]));
      return [item];
    });
    const { result } = renderHook(() => useLivePageModel(t, enabled));
    await waitFor(() => expect(result.current.scanComplete).toBe(true));
    expect(continueScanning).toHaveBeenCalledWith(true);
    expect(writeLiveCandidateCatalog).toHaveBeenCalledWith(
      'user', expect.objectContaining({ providerIds: ['test'], candidates: [candidate] }), expect.any(AbortSignal),
    );
  });

  it('ignores a late discovery progress callback after disabling', async () => {
    let progress!: NonNullable<Parameters<typeof getFeedItems>[3]>;
    vi.mocked(getFeedItems).mockImplementation((_credentials, _limit, _signal, onProgress) => {
      progress = onProgress!;
      return new Promise(() => {});
    });
    const { result, rerender } = renderHook(({ providers }) => useLivePageModel(t, providers), { initialProps: { providers: enabled } });
    await waitFor(() => expect(getFeedItems).toHaveBeenCalledOnce());
    rerender({ providers: disabled });
    act(() => expect(progress([item])).toBe(false));
    expect(result.current.candidates).toHaveLength(0);
  });
});

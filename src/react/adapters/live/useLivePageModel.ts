import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';

import { getRequestErrorMessage } from '../../presentation/requestErrorMessage';
import { getFeedItems } from '../../services/feeds';
import { readLiveCandidateCatalog, writeLiveCandidateCatalog } from '../../services/liveCandidateCatalog';
import { useAuth } from '../../state/useAuth';
import { catalogCandidates, mergeCandidates } from '../../features/live/liveCatalog';
import type { LiveCandidate, LiveEvent, LiveProviderRuntime } from '../../domain/liveEvents';

const REFRESH_INTERVAL_MS = 60_000;
const SNAPSHOT_MAX_AGE_MS = 5 * 60_000;
const RECONCILE_INTERVAL_MS = 24 * 60 * 60_000;
type ProviderState = 'loading' | 'healthy' | 'warning' | 'error';

export function useLivePageModel<Provider extends LiveProviderRuntime>(
  t: TFunction,
  providers: readonly Provider[],
) {
  const { credentials } = useAuth();
  const username = credentials?.username ?? '';
  const [candidates, setCandidates] = useState<LiveCandidate[]>([]);
  const candidatesRef = useRef<LiveCandidate[]>([]);
  const [events, setEvents] = useState<Record<string, LiveEvent>>({});
  const eventsRef = useRef<Record<string, LiveEvent>>({});
  const [providerStates, setProviderStates] = useState<Record<string, ProviderState>>({});
  const [scannedItems, setScannedItems] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanError, setScanError] = useState('');
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const cycleRunning = useRef(false);
  const scanCyclePending = useRef(false);
  const initialScanRunning = useRef(true);
  const newestItemIdRef = useRef<number | null>(null);
  const lastReconciledAtRef = useRef<number | null>(null);
  const lastDiscoveryAtRef = useRef(0);
  const activePlayback = useRef(new Set<string>());
  const lastChecked = useRef(new Map<string, number>());
  const cycleRef = useRef<(signal?: AbortSignal) => Promise<void>>(async () => {});

  const setCandidateState = useCallback((next: LiveCandidate[]) => {
    candidatesRef.current = next;
    setCandidates(next);
  }, []);

  const runCycle = useCallback(async (signal = new AbortController().signal) => {
    if (cycleRunning.current || signal.aborted) return;
    cycleRunning.current = true;
    setRefreshing(true);
    let successfulUpdates = 0;
    try {
      if (
        !initialScanRunning.current
        && credentials
        && username
        && Date.now() - lastDiscoveryAtRef.current >= REFRESH_INTERVAL_MS
      ) {
        let fullReconciliation = false;
        try {
          fullReconciliation = !lastReconciledAtRef.current
            || Date.now() - lastReconciledAtRef.current >= RECONCILE_INTERVAL_MS;
          const previousNewestItemId = newestItemIdRef.current;
          let previousCount = 0;
          if (fullReconciliation) setScanComplete(false);
          const items = await getFeedItems(credentials, undefined, signal, (loadedItems) => {
            const page = loadedItems.slice(previousCount);
            previousCount = loadedItems.length;
            setScannedItems(loadedItems.length);
            return fullReconciliation
              || previousNewestItemId === null
              || !page.some((item) => item.id === previousNewestItemId);
          }, 100);
          if (signal.aborted) return;
          const discovered = catalogCandidates(items, providers);
          const nextCandidates = fullReconciliation
            ? discovered
            : mergeIncrementalCandidates(
              discovered,
              candidatesRef.current,
              getNewItemCount(items, previousNewestItemId),
            );
          setCandidateState(nextCandidates);
          newestItemIdRef.current = items[0]?.id ?? previousNewestItemId;
          if (fullReconciliation) {
            lastReconciledAtRef.current = Date.now();
            setScanComplete(true);
          }
          await writeLiveCandidateCatalog(username, {
            candidates: nextCandidates,
            lastReconciledAt: lastReconciledAtRef.current,
            newestItemId: newestItemIdRef.current,
          });
          lastDiscoveryAtRef.current = Date.now();
          setScanError('');
          markEmptyProvidersHealthy(nextCandidates, providers, setProviderStates);
        } catch (error) {
          if (!signal.aborted) {
            if (fullReconciliation) setScanComplete(true);
            setScanError(getRequestErrorMessage(error, t, 'live.indexError'));
          }
        }
      }
      await Promise.all(providers.map(async (provider) => {
        const providerCandidates = candidatesRef.current.filter((candidate) => candidate.providerId === provider.id);
        if (providerCandidates.length === 0) {
          if (scanComplete) setProviderStates((current) => ({ ...current, [provider.id]: 'healthy' }));
          return;
        }
        const scheduled = scheduleProviderCandidates(provider, providerCandidates, eventsRef.current, lastChecked.current);
        try {
          const result = await provider.check(scheduled, signal);
          if (signal.aborted) return;
          const checkedAt = Date.now();
          successfulUpdates += result.updates.length;
          for (const update of result.updates) lastChecked.current.set(update.key, checkedAt);
          setEvents((current) => {
            const next = { ...current };
            for (const update of result.updates) {
              if (update.status === 'live' && update.data) {
                const candidate = providerCandidates.find((value) => value.key === update.key);
                if (candidate) next[update.key] = { candidate, data: update.data, checkedAt };
              } else if (provider.preserveEndedPlayback && activePlayback.current.has(update.key) && next[update.key]) {
                next[update.key] = { ...next[update.key], checkedAt, ended: true };
              } else {
                delete next[update.key];
              }
            }
            eventsRef.current = next;
            return next;
          });
          setProviderStates((current) => ({
            ...current,
            [provider.id]: result.failures === 0
              ? 'healthy'
              : result.updates.length === 0 ? 'error' : 'warning',
          }));
        } catch {
          if (!signal.aborted) setProviderStates((current) => ({ ...current, [provider.id]: 'error' }));
        }
      }));
      if (!signal.aborted && successfulUpdates > 0) setLastSuccessfulAt(Date.now());
    } finally {
      cycleRunning.current = false;
      if (!signal.aborted) setRefreshing(false);
      if (!signal.aborted && scanCyclePending.current) {
        scanCyclePending.current = false;
        queueMicrotask(() => void cycleRef.current(signal));
      }
    }
  }, [credentials, providers, scanComplete, setCandidateState, t, username]);
  cycleRef.current = runCycle;

  useEffect(() => {
    if (!credentials || !username) return;
    const controller = new AbortController();
    const { signal } = controller;
    candidatesRef.current = [];
    eventsRef.current = {};
    setCandidates([]);
    setEvents({});
    setProviderStates(Object.fromEntries(providers.map((provider) => [provider.id, 'loading'])));
    setScannedItems(0);
    setScanComplete(false);
    setScanError('');
    setLastSuccessfulAt(null);
    activePlayback.current.clear();
    lastChecked.current.clear();
    initialScanRunning.current = true;
    newestItemIdRef.current = null;
    lastReconciledAtRef.current = null;
    lastDiscoveryAtRef.current = 0;

    void (async () => {
      const cached = await readLiveCandidateCatalog(username);
      if (signal.aborted) return;
      newestItemIdRef.current = cached?.newestItemId ?? null;
      lastReconciledAtRef.current = cached?.lastReconciledAt ?? null;
      if (cached?.candidates.length) {
        setCandidateState(cached.candidates);
        void cycleRef.current(signal);
      }
      const fullReconciliation = !cached?.lastReconciledAt
        || Date.now() - cached.lastReconciledAt >= RECONCILE_INTERVAL_MS;
      const newestItemId = cached?.newestItemId ?? null;
      let previousCount = 0;
      try {
        const items = await getFeedItems(credentials, undefined, signal, (loadedItems) => {
          const page = loadedItems.slice(previousCount);
          previousCount = loadedItems.length;
          setScannedItems(loadedItems.length);
          setCandidateState(mergeCandidates(
            candidatesRef.current,
            catalogCandidates(page, providers, loadedItems.length - page.length),
          ));
          if (cycleRunning.current) scanCyclePending.current = true;
          else void cycleRef.current(signal);
          return fullReconciliation || newestItemId === null || !page.some((item) => item.id === newestItemId);
        }, 100);
        if (signal.aborted) return;
        const finalCandidates = fullReconciliation
          ? catalogCandidates(items, providers)
          : mergeIncrementalCandidates(
            catalogCandidates(items, providers),
            cached?.candidates ?? [],
            getNewItemCount(items, newestItemId),
          );
        setCandidateState(finalCandidates);
        const lastReconciledAt = fullReconciliation ? Date.now() : cached?.lastReconciledAt ?? null;
        await writeLiveCandidateCatalog(username, {
          candidates: finalCandidates,
          lastReconciledAt,
          newestItemId: fullReconciliation
            ? items[0]?.id ?? null
            : items[0]?.id ?? cached?.newestItemId ?? null,
        });
        if (signal.aborted) return;
        newestItemIdRef.current = fullReconciliation
          ? items[0]?.id ?? null
          : items[0]?.id ?? cached?.newestItemId ?? null;
        lastReconciledAtRef.current = lastReconciledAt;
        lastDiscoveryAtRef.current = Date.now();
        initialScanRunning.current = false;
        setScanComplete(true);
        markEmptyProvidersHealthy(finalCandidates, providers, setProviderStates);
        if (cycleRunning.current) scanCyclePending.current = true;
        else void cycleRef.current(signal);
      } catch (error) {
        if (signal.aborted) return;
        setScanError(getRequestErrorMessage(error, t, 'live.indexError'));
        initialScanRunning.current = false;
        setScanComplete(true);
        markEmptyProvidersHealthy(candidatesRef.current, providers, setProviderStates);
      }
    })();

    const refreshIntervalMs = providers.length > 0
      ? Math.min(...providers.map((provider) => provider.refreshIntervalMs))
      : REFRESH_INTERVAL_MS;
    const interval = window.setInterval(() => {
      setClock(Date.now());
      void cycleRef.current(signal);
    }, refreshIntervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setClock(Date.now());
        void cycleRef.current(signal);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [credentials, providers, setCandidateState, t, username]);

  const onPlaybackChange = useCallback((key: string, isOpen: boolean) => {
    if (isOpen) {
      activePlayback.current.add(key);
      return;
    }
    activePlayback.current.delete(key);
    setEvents((current) => {
      if (!current[key]?.ended) return current;
      const next = { ...current };
      delete next[key];
      eventsRef.current = next;
      return next;
    });
  }, []);

  const sections = useMemo(() => {
    const categories = new Map<string, {
      category: LiveProviderRuntime['category'];
      events: LiveEvent[];
      providerIds: string[];
    }>();
    for (const provider of providers) {
      const section = categories.get(provider.category.id) ?? { category: provider.category, events: [], providerIds: [] };
      section.providerIds.push(provider.id);
      section.events.push(...Object.values(events).filter((event) => (
        event.candidate.providerId === provider.id
        && (event.ended || clock - event.checkedAt <= SNAPSHOT_MAX_AGE_MS)
      )));
      categories.set(provider.category.id, section);
    }
    return [...categories.values()]
      .map((section) => ({
        ...section,
        events: section.events.sort((a, b) => a.candidate.feedOrder - b.candidate.feedOrder),
        state: getSectionState(section.providerIds, providerStates),
      }))
      .sort((a, b) => a.category.order - b.category.order);
  }, [clock, events, providerStates, providers]);

  return {
    candidates,
    sections,
    adapters: providers,
    scannedItems,
    scanComplete,
    scanError,
    lastSuccessfulAt,
    refreshing,
    refresh: () => void cycleRef.current(),
    onPlaybackChange,
    hasFreshEvents: sections.some((section) => section.events.some((event) => !event.ended)),
  };
}

export function scheduleProviderCandidates(
  provider: LiveProviderRuntime,
  candidates: readonly LiveCandidate[],
  events: Record<string, LiveEvent>,
  checked: Map<string, number>,
): LiveCandidate[] {
  if (provider.strategy === 'live-index') return [...candidates];
  const active = candidates.filter((candidate) => events[candidate.key] && !events[candidate.key].ended);
  const activeKeys = new Set(active.map((candidate) => candidate.key));
  const dormant = candidates
    .filter((candidate) => !activeKeys.has(candidate.key))
    .sort((a, b) => (checked.get(a.key) ?? 0) - (checked.get(b.key) ?? 0));
  const batchSize = Math.max(1, Math.ceil(candidates.length / provider.dormantSweepCycles));
  return [...active, ...dormant.slice(0, batchSize)];
}

function mergeIncrementalCandidates(
  recent: readonly LiveCandidate[],
  cached: readonly LiveCandidate[],
  newItemCount: number,
): LiveCandidate[] {
  const recentKeys = new Set(recent.map((candidate) => candidate.deduplicationKey));
  return [
    ...recent,
    ...cached
      .filter((candidate) => !recentKeys.has(candidate.deduplicationKey))
      .map((candidate) => ({ ...candidate, feedOrder: candidate.feedOrder + newItemCount })),
  ];
}

function getNewItemCount(items: readonly { id: number }[], previousNewestItemId: number | null): number {
  if (previousNewestItemId === null) return items.length;
  const previousNewestIndex = items.findIndex((item) => item.id === previousNewestItemId);
  return previousNewestIndex < 0 ? items.length : previousNewestIndex;
}

function markEmptyProvidersHealthy(
  candidates: readonly LiveCandidate[],
  providers: readonly LiveProviderRuntime[],
  setState: Dispatch<SetStateAction<Record<string, ProviderState>>>,
): void {
  const providerIds = new Set(candidates.map((candidate) => candidate.providerId));
  setState((current) => Object.fromEntries(providers.map((provider) => [
    provider.id,
    providerIds.has(provider.id) ? current[provider.id] ?? 'loading' : 'healthy',
  ])));
}

function getSectionState(providerIds: readonly string[], states: Record<string, ProviderState>): ProviderState {
  const values = providerIds.map((id) => states[id] ?? 'loading');
  if (values.every((value) => value === 'loading')) return 'loading';
  if (values.every((value) => value === 'error')) return 'error';
  if (values.some((value) => value === 'error' || value === 'warning')) return 'warning';
  return 'healthy';
}

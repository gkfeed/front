// Controlled benchmark. API pages and preview providers are simulated; the BFF
// transport is a zero-delay pass-through, so this is not production telemetry.
import { JSDOM } from 'jsdom';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useReviewPreviewPrefetch } from '../src/react/hooks/useReviewPreviewPrefetch';
import { createReviewSessionState, getActiveReviewIds, reviewSessionReducer } from '../src/react/hooks/reviewSession';
import type { ReviewPresentation, ReviewSessionEvent } from '../src/react/hooks/reviewSession';
import { getFeedItemChanges, syncFeedItems } from '../src/react/services/feedItems';
import { getEffectiveFeedPriorities } from '../src/react/state/feedPriority';
import { recordFeedDecision, type FeedDecision } from '../src/react/state/feedDecisions';
import * as remotePreview from '../src/react/services/remotePreview';
import { clearPreviewCache } from '../src/react/services/previewQueue';
import { FeatureUseCasesContext } from '../src/react/state/featureUseCasesContext';
import type { FeatureUseCases } from '../src/react/application/featureComposition';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://benchmark.invalid' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Image: dom.window.Image });
const readingMs = Number(process.env.BENCH_READ_MS ?? 750);
const apiFirstMs = Number(process.env.BENCH_API_FIRST_MS ?? 250);
const apiNextMs = Number(process.env.BENCH_API_NEXT_MS ?? 900);
const providerMs = (process.env.BENCH_PROVIDER_MS ?? '120,350,700').split(',').map(Number);
const scenario = process.env.BENCH_SCENARIO ?? 'decisions';
const seed = Number(process.env.BENCH_SEED ?? 1);
const apiDeleteMs = Number(process.env.BENCH_API_DELETE_MS ?? 250);
const totalItems = Number(process.env.BENCH_ITEMS ?? 1200);
const mode = process.env.BENCH_MODE ?? 'cached';
const decisionCount = Number(process.env.BENCH_DECISIONS ?? 12);
if (![readingMs, apiFirstMs, apiNextMs, apiDeleteMs, ...providerMs].every((n) => Number.isFinite(n) && n >= 0)
  || providerMs.length !== 3 || !Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(totalItems) || totalItems < 1001 || !Number.isSafeInteger(decisionCount) || decisionCount < 1 || decisionCount > totalItems
  || !['cached', 'paged'].includes(mode) || !['stable', 'reorder', 'jump', 'decisions'].includes(scenario)) {
  throw new Error('Invalid benchmark configuration');
}
const startedAt = performance.now();
const time = () => Math.round(performance.now() - startedAt);
const events: Array<{ time: number; event: string; id: number }> = [];
const providerState = new Map<number, 'running' | 'complete'>();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const waitUpstream = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  signal?.addEventListener('abort', abort, { once: true });
});
// Stable, seeded fixtures: repeated sources and a fixed decision for each ID.
function hash(id: number, salt: number): number {
  let value = Math.imul(id ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}
const rawItems = Array.from({ length: totalItems }, (_, i) => {
  const id = i + 1;
  return { id, feed_id: scenario === 'decisions' ? hash(id, seed) % 5 + 1 : id, title: `Story ${id}`, text: '', link: `https://provider-${id % 3}.example/story-${id}` };
});
// This fixture intercepts upstream API and provider calls. It does not start a
// BFF server or model its gate, cache, transport, parsing, or processing time.
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), 'https://benchmark.invalid');
  if (url.pathname.endsWith('/items/sync')) {
    const offset = Number(url.searchParams.get('cursor') ?? 0);
    const limit = Number(url.searchParams.get('limit'));
    const page = offset === 0 ? 1 : Math.floor((offset - 10) / 100) + 2;
    events.push({ time: time(), event: 'api-start', id: page });
    await waitUpstream(offset === 0 ? apiFirstMs : apiNextMs, init?.signal);
    events.push({ time: time(), event: 'api-complete', id: page });
    const next = Math.min(offset + limit, rawItems.length);
    return Response.json({ items: rawItems.slice(offset, next), next_cursor: next < rawItems.length ? String(next) : '', has_more: next < rawItems.length, sync_cursor: 'sync-1' });
  }
  if (url.pathname.endsWith('/items/changes')) {
    events.push({ time: time(), event: 'api-changes-start', id: 1 });
    await waitUpstream(apiNextMs, init?.signal);
    events.push({ time: time(), event: 'api-changes-complete', id: 1 });
    return Response.json({ upserted: [], deleted_ids: [], next_cursor: 'sync-2', has_more: false });
  }
  if (url.pathname === '/bff/open-graph') {
    const providerUrl = new URL(url.searchParams.get('url')!);
    const id = Number(providerUrl.pathname.split('-').at(-1));
    const provider = id % 3;
    providerState.set(id, 'running');
    events.push({ time: time(), event: 'provider-start', id });
    try {
      await waitUpstream(providerMs[provider]!, init?.signal);
    } catch (error) {
      providerState.delete(id);
      events.push({ time: time(), event: 'provider-abort', id });
      throw error;
    }
    providerState.set(id, 'complete');
    events.push({ time: time(), event: 'provider-complete', id });
    return Response.json({ url: providerUrl.href, title: `Story ${id}`, description: null, image: null, video: null, siteName: null, type: null, providerData: null });
  }
  throw new Error(`Unexpected request: ${url.href}`);
};
const useCases = { preview: remotePreview } as unknown as FeatureUseCases;
export function App({ ids, items }: { ids: number[]; items: typeof session.items }) {
  useReviewPreviewPrefetch({ enabled: true, items: items ?? [], activeReviewIds: ids });
  return null;
}
const presentation: ReviewPresentation = { itemOrder: 'asc', nsfwMode: 'show', hideTikTokItems: false, feedPriorities: {} };
let session = createReviewSessionState(presentation);
const root = createRoot(document.getElementById('root')!);
let wake: (() => void) | undefined;
let mounted = true;
function dispatch(event: ReviewSessionEvent) {
  if (!mounted) return;
  session = reviewSessionReducer(session, event);
  flushSync(() => root.render(<FeatureUseCasesContext value={useCases}><App items={session.items} ids={getActiveReviewIds(session)} /></FeatureUseCasesContext>));
  wake?.();
  wake = undefined;
}
const apiController = new AbortController();
const credentials = { username: 'benchmark', password: 'benchmark' };
// The cached case starts with the same full local snapshot that onCached
// provides to Reader, then uses the real API changes client in the background.
const cachedItems = rawItems.map(({ id, feed_id: feedId, link, title, text }) => ({ id, feedId, link, title, text }));
if (mode === 'cached') dispatch({ type: 'snapshotChanged', items: cachedItems, isComplete: false });
const apiPromise = (mode === 'cached'
  ? getFeedItemChanges(credentials, 'sync-1', apiController.signal).then(() => {
    dispatch({ type: 'snapshotChanged', items: cachedItems, isComplete: true });
  })
  : syncFeedItems(credentials, apiController.signal, (items) => {
    dispatch({ type: 'snapshotChanged', items, isComplete: false });
  }, 10).then((snapshot) => {
    dispatch({ type: 'snapshotChanged', items: snapshot.items, isComplete: true });
  })).catch((error: unknown) => {
  if (!apiController.signal.aborted) throw error;
});
const waits: number[] = [];
const queueChanges: Array<{
  step: number; itemId: number; feedId: number; action: string;
  before: number[]; afterAction: number[]; afterPriority: number[];
  predictedNext: number | null; actualNext: number | null; windowOverlap: number;
  priorities: Record<number, number>; loadedCount: number; beforeQueueCount: number; processingMs: number;
}> = [];
let decisions: readonly FeedDecision[] = [];
const deleteRequests: Promise<void>[] = [];
const openedIds: number[] = [];
let waitForCardMs = 0;
const states: Record<string, number> = { cached: 0, pending: 0, notStarted: 0 };
for (let step = 0; step < decisionCount; step += 1) {
  if (!session.currentItem) {
    const waitStart = performance.now();
    await new Promise<void>((resolve) => { wake = resolve; });
    waitForCardMs += Math.round(performance.now() - waitStart);
  }
  if (!session.currentItem) throw new Error('No reviewable item after API page');
  if (step === 3 && (scenario === 'reorder' || scenario === 'jump')) {
    const ids = scenario === 'jump' ? [20, 21, 22, 23] : [7, 8, 9, 10];
    const feedPriorities = Object.fromEntries(ids.map((id) => [id, 99]));
    dispatch({ type: 'presentationChanged', presentation: { ...presentation, feedPriorities } });
    events.push({ time: time(), event: 'reorder', id: ids[0]! });
  }
  const item = session.currentItem!;
  openedIds.push(item.id);
  const status = providerState.get(item.id);
  const category = status === 'complete' ? 'cached' : status === 'running' ? 'pending' : 'notStarted';
  states[category] += 1;
  events.push({ time: time(), event: category, id: item.id });
  const waitStart = performance.now();
  await remotePreview.loadRemotePreview(item.link, 'open-graph', new AbortController().signal);
  waits.push(Math.round(performance.now() - waitStart));
  await sleep(readingMs);
  const decisionStart = performance.now();
  const before = getActiveReviewIds(session);
  const kept = scenario !== 'decisions' || hash(item.id, seed + 177) % 100 < 60;
  if (kept) {
    dispatch({ type: 'keep', id: item.id });
  } else {
    dispatch({ type: 'delete', id: item.id, title: item.title });
    const deletion = session.deletions.find((entry) => entry.itemId === item.id);
    if (!deletion) throw new Error('Missing deletion operation');
    events.push({ time: time(), event: 'api-delete-start', id: item.id });
    deleteRequests.push(sleep(apiDeleteMs).then(() => {
      events.push({ time: time(), event: 'api-delete-complete', id: item.id });
      dispatch({ type: 'deletionSucceeded', id: item.id, operationId: deletion.operationId });
    }));
  }
  const afterAction = getActiveReviewIds(session);
  let priorities: Record<number, number> = {};
  if (scenario === 'decisions') {
    decisions = recordFeedDecision(decisions, { itemId: item.id, feedId: item.feedId, kept });
    priorities = { ...getEffectiveFeedPriorities({}, decisions) };
    dispatch({ type: 'presentationChanged', presentation: { ...presentation, feedPriorities: priorities } });
  }
  const afterPriority = getActiveReviewIds(session);
  const previousWindow = new Set(before.slice(1, 11));
  queueChanges.push({
    step, itemId: item.id, feedId: item.feedId, action: kept ? 'keep' : 'delete',
    before: before.slice(0, 12), afterAction: afterAction.slice(0, 11), afterPriority: afterPriority.slice(0, 11),
    predictedNext: before[1] ?? null, actualNext: afterPriority[0] ?? null,
    windowOverlap: afterPriority.slice(0, 10).filter((id) => previousWindow.has(id)).length,
    priorities, loadedCount: session.items?.length ?? 0, beforeQueueCount: before.length,
    processingMs: Math.round((performance.now() - decisionStart) * 100) / 100,
  });
}
const reviewElapsedMs = time();
const reviewEventCount = events.length;
mounted = false;
apiController.abort(); // End the background sync at the same point as the review.
flushSync(() => root.unmount());
clearPreviewCache();
await Promise.all([apiPromise, ...deleteRequests]);
await sleep(0); // Allow aborted upstream promises to record their final events.
// Includes reducer/render work after a click plus waiting for the following
// preview. Does not include the intentionally simulated reading pause.
const transitionMs = waits.slice(1).map((wait, index) => Math.round((wait + queueChanges[index]!.processingMs) * 100) / 100);
console.log(JSON.stringify({ scenario: { name: scenario, mode, totalItems, apiFirstMs, apiNextMs, apiDeleteMs, providerMs, readingMs, seed, decisions: decisionCount }, waitForCardMs, reviewElapsedMs, minLoaded: Math.min(...queueChanges.map((entry) => entry.loadedCount)), maxLoaded: Math.max(...queueChanges.map((entry) => entry.loadedCount)), minQueue: Math.min(...queueChanges.map((entry) => entry.beforeQueueCount)), maxQueue: Math.max(...queueChanges.map((entry) => entry.beforeQueueCount)), openedIds, uniqueOpened: new Set(openedIds).size, decisions: queueChanges,
  changedNext: queueChanges.filter((entry) => entry.predictedNext !== entry.actualNext).length,
  priorityReorders: queueChanges.filter((entry) => entry.afterAction.join(',') !== entry.afterPriority.join(',')).length,
  priorityChangedFollowing: queueChanges.filter((entry) => entry.afterAction[1] !== entry.afterPriority[1]).length,
  firstPreviewWaitMs: waits[0], transitionMs, maxTransitionMs: Math.max(0, ...transitionMs),
  totalTransitionMs: Math.round(transitionMs.reduce((sum, value) => sum + value, 0) * 100) / 100,
  waitsMs: waits, totalPreviewWaitMs: waits.reduce((a, b) => a + b, 0), states, providerStarts: events.slice(0, reviewEventCount).filter((e) => e.event === 'provider-start').length, providerAborts: events.slice(0, reviewEventCount).filter((e) => e.event === 'provider-abort').length, cleanupAborts: events.slice(reviewEventCount).filter((e) => e.event === 'provider-abort').length, events }, null, 2));
dom.window.close();

// Controlled benchmark. API pages and preview providers are simulated; the BFF
// transport is a zero-delay pass-through, so this is not production telemetry.
import { JSDOM } from 'jsdom';
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useReviewPreviewPrefetch } from '../src/react/hooks/useReviewPreviewPrefetch';
import { createReviewSessionState, getActiveReviewIds, reviewSessionReducer } from '../src/react/hooks/reviewSession';
import type { ReviewPresentation, ReviewSessionEvent } from '../src/react/hooks/reviewSession';
import { syncFeedItems } from '../src/react/services/feedItems';
import * as remotePreview from '../src/react/services/remotePreview';
import { clearPreviewCache } from '../src/react/services/previewQueue';
import { FeatureUseCasesContext } from '../src/react/state/featureUseCasesContext';
import type { FeatureUseCases } from '../src/react/application/featureComposition';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://benchmark.invalid' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Image: dom.window.Image });
const readingMs = Number(process.env.BENCH_READ_MS ?? 150);
const apiFirstMs = Number(process.env.BENCH_API_FIRST_MS ?? 250);
const apiNextMs = Number(process.env.BENCH_API_NEXT_MS ?? 900);
const providerMs = (process.env.BENCH_PROVIDER_MS ?? '120,350,700').split(',').map(Number);
const scenario = process.env.BENCH_SCENARIO ?? 'reorder';
if (![readingMs, apiFirstMs, apiNextMs, ...providerMs].every((n) => Number.isFinite(n) && n >= 0)
  || providerMs.length !== 3 || !['stable', 'reorder', 'jump'].includes(scenario)) {
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
const rawItems = Array.from({ length: 25 }, (_, i) => {
  const id = i + 1;
  return { id, feed_id: id, title: `Story ${id}`, text: '', link: `https://provider-${id % 3}.example/story-${id}` };
});
// This fixture intercepts upstream API and provider calls. It does not start a
// BFF server or model its gate, cache, transport, parsing, or processing time.
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input), 'https://benchmark.invalid');
  if (url.pathname.endsWith('/items/sync')) {
    const page = url.searchParams.has('cursor') ? 2 : 1;
    events.push({ time: time(), event: 'api-start', id: page });
    await waitUpstream(page === 1 ? apiFirstMs : apiNextMs, init?.signal);
    events.push({ time: time(), event: 'api-complete', id: page });
    return Response.json({ items: page === 1 ? rawItems.slice(0, 8) : rawItems.slice(8), next_cursor: page === 1 ? 'page-2' : '', has_more: page === 1, sync_cursor: 'sync-1' });
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
function dispatch(event: ReviewSessionEvent) {
  session = reviewSessionReducer(session, event);
  flushSync(() => root.render(<FeatureUseCasesContext value={useCases}><App items={session.items} ids={getActiveReviewIds(session)} /></FeatureUseCasesContext>));
  wake?.();
  wake = undefined;
}
const apiPromise = syncFeedItems({ username: 'benchmark', password: 'benchmark' }, undefined, (items) => {
  dispatch({ type: 'snapshotChanged', items, isComplete: false });
}, 8).then((snapshot) => {
  dispatch({ type: 'snapshotChanged', items: snapshot.items, isComplete: true });
});
const waits: number[] = [];
const openedIds: number[] = [];
let waitForCardMs = 0;
const states: Record<string, number> = { cached: 0, pending: 0, notStarted: 0 };
for (let step = 0; step < 12; step += 1) {
  if (!session.currentItem) {
    const waitStart = performance.now();
    await new Promise<void>((resolve) => { wake = resolve; });
    waitForCardMs += Math.round(performance.now() - waitStart);
  }
  if (!session.currentItem) throw new Error('No reviewable item after API page');
  if (step === 3 && scenario !== 'stable') {
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
  dispatch({ type: 'keep', id: item.id });
}
const reviewElapsedMs = time();
await apiPromise;
flushSync(() => root.unmount());
clearPreviewCache();
await sleep(0); // Allow aborted upstream promises to record their final events.
console.log(JSON.stringify({ scenario: { name: scenario, apiFirstMs, apiNextMs, providerMs, readingMs, cards: 12 }, waitForCardMs, reviewElapsedMs, openedIds, uniqueOpened: new Set(openedIds).size, waitsMs: waits, totalPreviewWaitMs: waits.reduce((a, b) => a + b, 0), states, providerStarts: events.filter((e) => e.event === 'provider-start').length, providerAborts: events.filter((e) => e.event === 'provider-abort').length, events }, null, 2));
dom.window.close();

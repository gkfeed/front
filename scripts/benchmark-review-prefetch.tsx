// Controlled benchmark of the real hook and shared queue, with simulated BFF latency.
// Run using scripts/benchmark-review-prefetch.sh; results are not production telemetry.
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useReviewPreviewPrefetch } from '../src/react/hooks/useReviewPreviewPrefetch';
import { FeatureUseCasesContext } from '../src/react/state/featureUseCasesContext';
import * as queue from '../src/react/services/previewQueue';
const { clearPreviewCache, loadQueuedPreview } = queue;
const reprioritizeQueuedPreview = (Object.assign({}, queue) as Partial<typeof queue>).reprioritizeQueuedPreview;
import type { FeatureUseCases } from '../src/react/application/featureComposition';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://benchmark.invalid' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Image: dom.window.Image, IS_REACT_ACT_ENVIRONMENT: true });
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const startedAt = performance.now();
const time = () => Math.round(performance.now() - startedAt);
const events: Array<{ time: number; event: string; id: number }> = [];
const state = new Map<number, 'running' | 'complete'>();
const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, feedId: i + 1, title: `Story ${i + 1}`, text: '', link: `https://example.com/story-${i + 1}` }));
const preview = { openGraphPreview: null, liquipediaMatch: null };
const loadRemotePreview = (url: string, source: string, signal: AbortSignal, priority?: number) => {
  const id = Number(url.split('-').at(-1));
  return loadQueuedPreview(`${source}:${url}`, (networkSignal) => new Promise<typeof preview>((resolve, reject) => {
    state.set(id, 'running');
    events.push({ time: time(), event: 'start', id });
    const timer = setTimeout(() => { state.set(id, 'complete'); events.push({ time: time(), event: 'complete', id }); resolve(preview); }, 300);
    networkSignal.addEventListener('abort', () => {
      clearTimeout(timer);
      state.delete(id);
      events.push({ time: time(), event: 'abort', id });
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  }), signal, priority);
};
const useCases = { preview: { loadRemotePreview, reprioritizeRemotePreview: (url: string, source: string, priority: number) => reprioritizeQueuedPreview?.(`${source}:${url}`, priority) } } as unknown as FeatureUseCases;
export function App({ ids }: { ids: number[] }) {
  useReviewPreviewPrefetch({ enabled: true, items, activeReviewIds: ids });
  return null;
}
const root = createRoot(document.getElementById('root')!);
let ids = items.map(({ id }) => id);
const waits: number[] = [];
const states: Record<string, number> = { cached: 0, pending: 0, notStarted: 0 };
for (let step = 0; step < 12; step += 1) {
  if (step === 3) {
    // Priority changes after a decision: a previously distant source moves up.
    ids = [ids[0]!, ...ids.slice(8, 12), ...ids.slice(1, 8), ...ids.slice(12)];
    events.push({ time: time(), event: 'reorder', id: ids[1]! });
  }
  const id = ids[0]!;
  await act(async () => { root.render(<FeatureUseCasesContext value={useCases}><App ids={ids} /></FeatureUseCasesContext>); });
  const status = state.get(id);
  const category = status === 'complete' ? 'cached' : status === 'running' ? 'pending' : 'notStarted';
  states[category] += 1;
  events.push({ time: time(), event: category, id });
  const waitStart = performance.now();
  await loadRemotePreview(items[id - 1]!.link, 'open-graph', new AbortController().signal);
  waits.push(Math.round(performance.now() - waitStart));
  await sleep(150); // reading time after the preview appears
  ids = ids.slice(1);
}
await act(async () => root.unmount());
clearPreviewCache();
console.log(JSON.stringify({ scenario: { responseMs: 300, readingMs: 150, cards: 12, reorderAfter: 3 }, waitsMs: waits, totalWaitMs: waits.reduce((a, b) => a + b, 0), states, networkStarts: events.filter((e) => e.event === 'start').length, aborts: events.filter((e) => e.event === 'abort').length, events }, null, 2));
dom.window.close();

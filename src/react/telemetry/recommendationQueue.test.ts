// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecommendationEvent } from '../../../shared/recommendationEvents';

const event: RecommendationEvent = {
  schemaVersion: 1, eventId: 'event', subjectId: 'anonymous',
  occurredAt: '2026-11-13T12:00:00.000Z', action: 'delete', activeMs: 90_000,
  item: { id: 1, feedId: 2, title: 'Title', text: 'Text', link: 'https://example.com' },
};
const key = 'gkfeed.recommendation-outbox.v1:event';
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  });
});
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('recommendation outbox', () => {
  it('keeps failures across reloads and removes only acknowledged events', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const firstVisit = await import('./recommendationQueue');
    firstVisit.enqueueRecommendationEvent(event);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(event);
    await firstVisit.flushRecommendationEvents();

    vi.resetModules();
    fetchMock.mockResolvedValue({ ok: true });
    const secondVisit = await import('./recommendationQueue');
    await secondVisit.flushRecommendationEvents();
    expect(localStorage.getItem(key)).toBeNull();
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ events: [event] });
  });

  it('continues sending in memory when browser storage is unavailable', async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const queue = await import('./recommendationQueue');
    queue.enqueueRecommendationEvent(event);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    await queue.flushRecommendationEvents();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ events: [event] });
  });
});

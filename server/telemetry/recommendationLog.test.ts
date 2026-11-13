import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHttpServer } from '../http/httpServer.js';

const event = {
  schemaVersion: 1, eventId: 'event', subjectId: 'anonymous',
  occurredAt: '2026-11-13T12:00:00.000Z', action: 'delete', activeMs: 90_000,
  item: { id: 1, feedId: 2, title: 'Title', text: 'Text', link: 'https://example.com' },
};

const server = createHttpServer();
let directory: string;
let url: string;
let logPath: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'recommendation-log-'));
  logPath = join(directory, 'events.jsonl');
  vi.stubEnv('RECOMMENDATION_LOG_PATH', logPath);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/bff/recommendation-events`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function post(events: unknown[], headers = {}) {
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ events }) });
}

describe('recommendation event ingestion', () => {
  it('serves category probabilities scoped to the subject, counting each item once', async () => {
    const immediate = { ...event, eventId: 'immediate', activeMs: 9999, item: { ...event.item, id: 2 } };
    const other = { ...event, eventId: 'other', subjectId: 'other' };
    expect((await post([event, event, immediate, other])).status).toBe(200);
    const scoresUrl = url.replace('/recommendation-events', '/recommendation-feed-scores');
    const response = await fetch(`${scoresUrl}?subjectId=anonymous`);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ classificationVersion: 1, viewedThresholdMs: 10_000,
      feeds: [{ subjectId: 'anonymous', feedId: 2, itemCount: 2, category: null,
        counts: { keep_for_later: 0, delete_immediately: 1, delete_after_viewing: 1 },
        probabilities: { keep_for_later: 0, delete_immediately: 0.5, delete_after_viewing: 0.5 } }] });
    expect((await fetch(scoresUrl)).status).toBe(400);
    expect((await fetch(scoresUrl, { method: 'POST' })).status).toBe(405);
  });

  it('returns no guessed scores for an empty log or an unknown subject', async () => {
    const scoresUrl = url.replace('/recommendation-events', '/recommendation-feed-scores');
    expect(await (await fetch(`${scoresUrl}?subjectId=anonymous`)).json()).toMatchObject({ feeds: [] });
    await post([event]);
    expect(await (await fetch(`${scoresUrl}?subjectId=unknown`)).json()).toMatchObject({ feeds: [] });
  });

  it('persists snapshots and derives the category instead of trusting client labels', async () => {
    const response = await post([{ ...event, password: 'must-not-be-stored', category: 'keep_for_later' }]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: 1 });
    const stored = JSON.parse((await readFile(logPath, 'utf8')).trim());
    expect(stored).toMatchObject(event);
    expect(stored.category).toBe('delete_after_viewing');
    expect(stored.classificationVersion).toBe(1);
    expect(stored.receivedAt).toEqual(expect.any(String));
    expect(stored).not.toHaveProperty('label');
    expect(stored).not.toHaveProperty('password');
  });

  it('rejects malformed events and oversized batches before writing', async () => {
    expect((await post([{ ...event, activeMs: -1 }])).status).toBe(400);
    expect((await post([{ ...event, action: 'like' }])).status).toBe(400);
    expect((await post(Array(21).fill(event))).status).toBe(400);
    expect((await post([{ ...event, item: { ...event.item, text: 'x'.repeat(1024 * 1024) } }])).status).toBe(413);
    await expect(readFile(logPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects other origins, non-JSON requests and reads', async () => {
    expect((await post([event], { Origin: 'https://another.example' })).status).toBe(403);
    expect((await fetch(url, { method: 'POST', body: '{}' })).status).toBe(415);
    expect((await fetch(url)).status).toBe(405);
  });
});

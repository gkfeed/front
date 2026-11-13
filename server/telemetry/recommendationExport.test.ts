import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

it('exports classified items and per-feed scores without duplicating retries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recommendation-export-'));
  try {
    const input = join(directory, 'events.jsonl');
    const decision = { schemaVersion: 1, action: 'delete', activeMs: 100,
      eventId: 'quick', subjectId: 'reader', occurredAt: '2026-11-13T12:00:00Z',
      item: { id: 1, feedId: 2, title: 'Title', text: '', link: 'https://example.com' } };
    const watched = { ...decision, eventId: 'watched', activeMs: 60_000, item: { ...decision.item, id: 2 } };
    await writeFile(input, [decision, decision, watched]
      .map((event) => JSON.stringify(event)).join('\n') + '\npartial');
    const { stdout, stderr } = await promisify(execFile)(process.execPath, ['scripts/export-recommendation-dataset.mjs', input]);
    const rows = stdout.trim().split('\n').map((line) => JSON.parse(line));
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.activeMs)).toEqual([100, 60_000]);
    expect(rows.map((row) => row.category)).toEqual(['delete_immediately', 'delete_after_viewing']);
    const scored = await promisify(execFile)(process.execPath, ['scripts/export-recommendation-dataset.mjs', input, '--feed-scores']);
    const feeds = scored.stdout.trim().split('\n').map((line) => JSON.parse(line));
    expect(feeds).toHaveLength(1);
    expect(feeds[0]).toMatchObject({ subjectId: 'reader', feedId: 2, itemCount: 2, category: null,
      probabilities: { keep_for_later: 0, delete_immediately: 0.5, delete_after_viewing: 0.5 } });
    expect(stderr).toContain('Skipped 1 malformed lines');
  } finally { await rm(directory, { recursive: true, force: true }); }
});

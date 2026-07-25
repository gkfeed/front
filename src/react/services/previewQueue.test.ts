import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearPreviewCache, loadQueuedPreview } from './previewQueue';

afterEach(() => {
  clearPreviewCache();
});

describe('loadQueuedPreview', () => {
  it('deduplicates preview requests by cache key', async () => {
    const load = vi.fn().mockResolvedValue('preview');

    const first = loadQueuedPreview('same-url', load);
    const second = loadQueuedPreview('same-url', load);

    await expect(Promise.all([first, second])).resolves.toEqual(['preview', 'preview']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('runs no more than four preview requests concurrently', async () => {
    const releases: Array<() => void> = [];
    const load = vi.fn(() => new Promise<string>((resolve) => {
      releases.push(() => resolve('preview'));
    }));

    const requests = Array.from(
      { length: 6 },
      (_, index) => loadQueuedPreview(`url-${index}`, load),
    );

    expect(load).toHaveBeenCalledTimes(4);
    releases[0]!();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    releases[1]!();
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(6));
    releases.slice(2).forEach((release) => release());

    await expect(Promise.all(requests)).resolves.toEqual(Array(6).fill('preview'));
  });
});

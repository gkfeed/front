// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import type { RemotePreview } from '../domain/feedItemCardContracts';
import { abortPrefetches, prefetchFeedItem } from './previewPrefetch';

describe('preview prefetch cancellation', () => {
  it('does not start media requests from a late response after cancellation', async () => {
    let resolve!: (preview: RemotePreview) => void;
    const loadRemotePreview = vi.fn(() => new Promise<RemotePreview>((done) => { resolve = done; }));
    const urls = new Set<string>();
    const controllers = new Map<string, AbortController>();
    prefetchFeedItem(
      { id: 1, feedId: 1, title: 'Match', text: '', link: 'https://www.hltv.org/matches/123/example' },
      { loadRemotePreview }, urls, controllers, 'show',
    );
    abortPrefetches(controllers);
    resolve({
      liquipediaMatch: null,
      openGraphPreview: {
        url: 'https://www.hltv.org/matches/123/example', title: 'Match', description: '',
        image: 'https://example.com/late.jpg', type: null, video: null, providerData: null, siteName: null,
      },
    });
    await Promise.resolve();
    expect(urls.size).toBe(0);
    expect(controllers.size).toBe(0);
  });
});

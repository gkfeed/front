// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_REMOTE_PREVIEW } from '../domain/remotePreview';
import type { RemotePreview } from '../domain/feedItemCardContracts';
import type { FeedItem } from '../types';
import { prefetchStoryVideo } from './storyVideoPrefetch';

const story: FeedItem = {
  id: 1, feedId: 1, title: 'inst: author', text: '',
  link: 'https://tempfile.org/story/download',
};

afterEach(() => vi.restoreAllMocks());

describe('prefetchStoryVideo', () => {
  it('buffers a direct story silently and releases its network resource on cleanup', () => {
    const createElement = vi.spyOn(document, 'createElement');
    const load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const loadRemotePreview = vi.fn().mockResolvedValue(EMPTY_REMOTE_PREVIEW);
    const dispose = prefetchStoryVideo(story, { loadRemotePreview }, 'show');
    const video = createElement.mock.results[0]!.value as HTMLVideoElement;

    expect(video.tagName).toBe('VIDEO');
    expect(video.src).toBe(story.link);
    expect(video.preload).toBe('auto');
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(false);
    expect(loadRemotePreview).not.toHaveBeenCalled();

    dispose();
    expect(video.hasAttribute('src')).toBe(false);
    expect(load).toHaveBeenCalledOnce();
  });

  it('does not buffer unrelated feeds or hidden NSFW stories', () => {
    const createElement = vi.spyOn(document, 'createElement');
    const loadRemotePreview = vi.fn();
    prefetchStoryVideo({ ...story, title: 'News', link: 'https://example.com/movie.mp4' }, { loadRemotePreview }, 'show')();
    prefetchStoryVideo({ ...story, link: 'https://pornhub.com/movie.mp4' }, { loadRemotePreview }, 'hide')();
    expect(createElement).not.toHaveBeenCalled();
    expect(loadRemotePreview).not.toHaveBeenCalled();
  });

  it('ignores late metadata after navigation and aborts its subscription', async () => {
    const createElement = vi.spyOn(document, 'createElement');
    let resolve!: (preview: RemotePreview) => void;
    const loadRemotePreview = vi.fn(() => new Promise<RemotePreview>((done) => { resolve = done; }));
    const dispose = prefetchStoryVideo({ ...story, link: 'https://www.instagram.com/reel/abc123/' }, { loadRemotePreview }, 'show');
    expect(loadRemotePreview).toHaveBeenCalledOnce();
    const signal = loadRemotePreview.mock.calls[0] as unknown as [string, string, AbortSignal];
    dispose();
    resolve(remoteVideo());
    await Promise.resolve();
    expect(signal[2].aborted).toBe(true);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('buffers the video selected from remote metadata', async () => {
    const createElement = vi.spyOn(document, 'createElement');
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    const loadRemotePreview = vi.fn().mockResolvedValue(remoteVideo());
    const dispose = prefetchStoryVideo({ ...story, link: 'https://www.instagram.com/reel/abc123/' }, { loadRemotePreview }, 'show');
    await Promise.resolve();
    const video = createElement.mock.results[0]!.value as HTMLVideoElement;
    expect(video.src).toBe('https://example.com/story.mp4');
    dispose();
  });
});

function remoteVideo(): RemotePreview {
  return { ...EMPTY_REMOTE_PREVIEW, openGraphPreview: {
    type: 'video', url: story.link, video: 'https://example.com/story.mp4',
    image: null, title: null, description: null, siteName: null, providerData: null,
  } };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./pageFetcher.js', () => ({ fetchHtml: vi.fn() }));

import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from './errors.js';
import { parseOpenGraph } from './openGraph.js';
import { fetchHtml } from './pageFetcher.js';
import { redditOpenGraphAdapter } from './providers/reddit.js';

const postUrl = new URL('https://www.reddit.com/r/omarchy/comments/1wrjlkh/introducing_omaphoto_photo_editor/');
const oldHtml = `
  <meta property="og:title" content="Introducing OmaPhoto | Photo Editor">
  <meta property="og:image" content="https://external-preview.redd.it/poster.png">
  <div data-fullname="t3_related">
    <a class="title">Related post</a>
    <div data-hls-url="https://v.redd.it/related/HLSPlaylist.m3u8"></div>
  </div>
  <div data-fullname="t3_1wrjlkh">
    <a class="title">Introducing OmaPhoto | Photo Editor</a>
    <div data-hls-url="https://v.redd.it/tma4eya482sh1/HLSPlaylist.m3u8?a=token&amp;v=1&amp;f=sd"></div>
  </div>`;

beforeEach(() => { vi.mocked(fetchHtml).mockReset(); });

describe('Reddit post previews', () => {
  it('extracts the requested post title, poster, and HLS stream with decoded query parameters', () => {
    expect(parseOpenGraph(oldHtml, postUrl)).toMatchObject({
      url: postUrl.href,
      title: 'Introducing OmaPhoto | Photo Editor',
      image: 'https://external-preview.redd.it/poster.png',
      video: 'https://v.redd.it/tma4eya482sh1/HLSPlaylist.m3u8?a=token&v=1&f=sd',
      siteName: 'Reddit',
      type: 'video',
    });
  });

  it('keeps a clean title and the share image when only crawler metadata is available', () => {
    expect(parseOpenGraph(`
      <meta property="og:title" content="From the omarchy community on Reddit: Introducing OmaPhoto | Photo Editor">
      <meta property="og:image" content="https://share.redd.it/preview/post/1wrjlkh">
    `, postUrl)).toMatchObject({
      title: 'Introducing OmaPhoto | Photo Editor',
      image: 'https://share.redd.it/preview/post/1wrjlkh',
      video: null,
    });
  });

  it.each(['[removed]', '[deleted]'])('marks a post with %s content as deleted and clears stale media', (body) => {
    const html = oldHtml.replace('<a class="title">Introducing OmaPhoto | Photo Editor</a>',
      `<a class="title">Introducing OmaPhoto | Photo Editor</a><div class="usertext-body"><div class="md"><p>${body}</p></div></div>`);
    expect(parseOpenGraph(html, postUrl)).toMatchObject({
      title: 'Introducing OmaPhoto | Photo Editor',
      image: null,
      video: null,
      type: null,
      providerData: { provider: 'reddit', status: 'deleted' },
    });
  });

  it('recognizes a removed link post without self text', () => {
    expect(parseOpenGraph(oldHtml.replace('data-fullname="t3_1wrjlkh"', 'class="link removed" data-fullname="t3_1wrjlkh"'), postUrl))
      .toMatchObject({ image: null, video: null, providerData: { provider: 'reddit', status: 'deleted' } });
  });

  it('recognizes removal in the modern page used by the fetch fallback', () => {
    expect(parseOpenGraph(`
      <meta property="og:image" content="https://www.redditstatic.com/reddit-logo.png">
      <shreddit-post id="t3_1wrjlkh" post-title="Post title" is-removed="true"></shreddit-post>
    `, postUrl)).toMatchObject({
      title: 'Post title', image: null, video: null,
      providerData: { provider: 'reddit', status: 'deleted' },
    });
  });

  it('ignores removal of other posts and comments and a deleted author', () => {
    const html = oldHtml.replace('<a class="title">Related post</a>',
      '<a class="title">Related post</a><div class="usertext-body">[removed]</div>')
      + '<div class="comment"><span class="author">[deleted]</span><div class="usertext-body">[deleted]</div></div>';
    expect(parseOpenGraph(html, postUrl)).toMatchObject({
      image: 'https://external-preview.redd.it/poster.png',
      providerData: null,
    });
  });

  it('does not mark a discussion about removal as deleted', () => {
    const html = oldHtml.replace('data-fullname="t3_1wrjlkh"', 'is-removed="false" data-fullname="t3_1wrjlkh"')
      .replace('<a class="title">Introducing OmaPhoto | Photo Editor</a>',
        '<a class="title">Introducing OmaPhoto | Photo Editor</a><div class="usertext-body">Why does Reddit show [removed]?</div>');
    expect(parseOpenGraph(html, postUrl).providerData).toBeNull();
  });

  it.each([
    'https://example.com/video.m3u8',
    'http://127.0.0.1/video.m3u8',
    'javascript:alert(1)',
  ])('ignores an invalid Reddit stream %s', (stream) => {
    expect(parseOpenGraph(oldHtml.replace(/https:\/\/v\.redd\.it\/tma4eya482sh1\/HLSPlaylist\.m3u8\?a=token&amp;v=1&amp;f=sd/, stream), postUrl).video)
      .toBeNull();
  });

  it('fetches Old Reddit while preserving the original post link and execution context', async () => {
    vi.mocked(fetchHtml).mockResolvedValue({ html: oldHtml, url: new URL('https://old.reddit.com' + postUrl.pathname) });
    const context = createDetachedRequestExecutionContext();
    const preview = await redditOpenGraphAdapter.fetch(postUrl, context);

    expect(fetchHtml).toHaveBeenCalledWith(
      new URL('https://old.reddit.com' + postUrl.pathname),
      expect.any(String), {}, context,
    );
    expect(preview.url).toBe(postUrl.href);
    expect(preview.video).toContain('HLSPlaylist.m3u8');
  });

  it('falls back to crawler metadata if Old Reddit blocks the request', async () => {
    vi.mocked(fetchHtml)
      .mockRejectedValueOnce(new PreviewError('Reddit returned HTTP 403', 'upstream_error'))
      .mockResolvedValueOnce({ html: '<meta property="og:title" content="Post title">', url: postUrl });
    await expect(redditOpenGraphAdapter.fetch(postUrl)).resolves.toMatchObject({ title: 'Post title' });
    expect(vi.mocked(fetchHtml).mock.calls[1]?.[0]).toEqual(postUrl);
  });

  it('does not retry rejected public URL policy checks', async () => {
    vi.mocked(fetchHtml).mockRejectedValue(new PreviewError('Private URL', 'private_url'));
    await expect(redditOpenGraphAdapter.fetch(postUrl)).rejects.toMatchObject({ kind: 'private_url' });
    expect(fetchHtml).toHaveBeenCalledTimes(1);
  });
});

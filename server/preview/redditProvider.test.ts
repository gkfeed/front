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

  it('uses the requested text post image instead of a stale Open Graph crop', () => {
    const url = new URL('https://www.reddit.com/r/omarchy/comments/1wtbciv/i_turned_my_personal_daily_workflow_into_a_tui/');
    const image = 'https://preview.redd.it/p7ddkf7cwgsh1.jpg?width=1920&format=pjpg&auto=webp&s=78c290d1ff0a256f5038978c3441335056287729';
    expect(parseOpenGraph(`
      <meta property="og:image" content="https://external-preview.redd.it/stale.jpg">
      <div data-fullname="t3_related"><div class="usertext-body"><img src="https://i.redd.it/related.jpg"></div></div>
      <div data-fullname="t3_1wtbciv"><div class="usertext-body"><div class="md">
        <p><a href="https://github.com/ILDaviz/lyra-tui">GitHub</a></p>
        <p><a href="${image.replaceAll('&', '&amp;')}">Uploaded image</a></p>
      </div></div></div>
    `, url)).toMatchObject({ image, video: null });
  });

  it('extracts an inline image from the modern post body', () => {
    expect(parseOpenGraph(`
      <shreddit-post id="t3_1wrjlkh"><div slot="text-body"><img src="https://i.redd.it/photo.png"></div></shreddit-post>
    `, postUrl).image).toBe('https://i.redd.it/photo.png');
  });

  it('uses the first full-size gallery image rather than its tile or stale metadata crop', () => {
    const url = new URL('https://www.reddit.com/r/omarchy/comments/1wtsb6e/recognition_see_whos_home_at_a_glance_from_the/');
    const image = 'https://preview.redd.it/tuy63fijaksh1.png?width=568&format=png&auto=webp&s=9d51c42e0b0c8ec9c43014a48f3f284f7c5936d0';
    const html = `
      <meta property="og:image" content="https://external-preview.redd.it/stale.png">
      <div data-fullname="t3_related"><a class="gallery-item-thumbnail-link" href="https://i.redd.it/related.png"></a></div>
      <div data-fullname="t3_1wtsb6e" data-is-gallery="true">
        <a class="thumbnail"><img src="https://preview.redd.it/tuy63fijaksh1.png?width=140"></a>
        <div class="media-gallery">
          <div class="gallery-tiles"><img src="https://preview.redd.it/tuy63fijaksh1.png?width=108"></div>
          <div class="gallery-preview" style="display: none">
            <a class="gallery-item-thumbnail-link" href="${image.replaceAll('&', '&amp;')}">
              <img src="https://preview.redd.it/tuy63fijaksh1.png?width=320">
            </a>
          </div>
          <a class="gallery-item-thumbnail-link" href="https://preview.redd.it/nt0jdeijaksh1.png?width=520"></a>
        </div>
      </div>`;
    expect(parseOpenGraph(html, url)).toMatchObject({ image, video: null });
    expect(parseOpenGraph(html.replace('data-is-gallery="true"', 'class="removed" data-is-gallery="true"'), url))
      .toMatchObject({ image: null, providerData: { provider: 'reddit', status: 'deleted' } });
  });

  it.each([
    'https://preview.redd.it.example.org/photo.jpg',
    'https://example.com/photo.jpg',
    'http://127.0.0.1/photo.jpg',
    'https://preview.redd.it/not-an-image',
  ])('keeps metadata when the post links a non-Reddit image %s', (source) => {
    expect(parseOpenGraph(oldHtml.replace('<a class="title">Introducing OmaPhoto | Photo Editor</a>',
      `<a class="title">Introducing OmaPhoto | Photo Editor</a><div class="usertext-body"><a href="${source}">Link</a></div>`), postUrl).image)
      .toBe('https://external-preview.redd.it/poster.png');
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

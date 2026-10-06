import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseYoutubeChannelId, resolveYoutubeChannel } from './youtubeChannel.js';
import { fetchHtml } from './preview/pageFetcher.js';
import { PreviewError } from './preview/errors.js';
import { createDetachedRequestExecutionContext } from './application/requestExecutionContext.js';

vi.mock('./preview/pageFetcher.js', () => ({ fetchHtml: vi.fn() }));
afterEach(() => vi.resetAllMocks());

const ID = 'UC5TRrMsWLy7flttFTyS-bOA';
const OTHER_ID = 'UC0000000000000000000000';
const PAGE = new URL('https://www.youtube.com/@sendependa_dio_games');
const metadata = `<html><head>
  <link rel="canonical" href="https://www.youtube.com/channel/${ID}">
  <link rel="alternate" type="application/rss+xml" href="https://www.youtube.com/feeds/videos.xml?channel_id=${ID}">
  <meta property="og:url" content="https://www.youtube.com/channel/${ID}">
</head><body><script>var ytInitialData = {"recommendedChannelId":"${OTHER_ID}"};</script></body></html>`;

describe('YouTube channel resolution', () => {
  it.each(['', '/videos', '/shorts', '/streams'])('resolves the page owner and preserves %s', async (tab) => {
    vi.mocked(fetchHtml).mockResolvedValue({ html: metadata, url: PAGE });
    const context = createDetachedRequestExecutionContext();
    await expect(resolveYoutubeChannel(`${PAGE.href}${tab}?si=share`, context)).resolves.toEqual({
      channelId: ID, url: `https://www.youtube.com/channel/${ID}${tab}`,
    });
    expect(fetchHtml).toHaveBeenCalledWith(PAGE, undefined, { maxBytes: 3_000_000 }, context);
  });

  it('is idempotent and does not fetch permanent channel URLs', async () => {
    const url = `https://www.youtube.com/channel/${ID}/videos`;
    const first = await resolveYoutubeChannel(`${url}/?si=share#top`);
    await expect(resolveYoutubeChannel(first.url)).resolves.toEqual(first);
    expect(first.url).toBe(url);
    expect(fetchHtml).not.toHaveBeenCalled();
  });

  it('reads canonical metadata emitted after the head, as on current YouTube pages', () => {
    expect(parseYoutubeChannelId(`<html><head><style>${' '.repeat(260_000)}</style></head><body>
      <link rel="canonical" href="https://www.youtube.com/channel/${ID}">
      <meta property="og:url" content="https://www.youtube.com/channel/${ID}">
    </body></html>`, PAGE)).toBe(ID);
  });

  it.each([
    `<link rel="canonical" href="/channel/${ID}">`,
    `<meta property="og:url" content="https://www.youtube.com/channel/${ID}">`,
    `<meta itemprop="channelId" content="${ID}">`,
    `<link rel="alternate" type="application/rss+xml" href="/feeds/videos.xml?alt=rss&amp;channel_id=${ID}">`,
  ])('accepts explicit page-level metadata %s', (tag) => {
    expect(parseYoutubeChannelId(`<html><head>${tag}</head></html>`, PAGE)).toBe(ID);
  });

  it.each([
    '<html><head><title>Consent required</title></head></html>',
    `<html><head></head><body><a href="/channel/${OTHER_ID}">Suggested channel</a><meta itemprop="channelId" content="${OTHER_ID}"></body></html>`,
    `<html><head><script>const example = '<meta itemprop="channelId" content="${OTHER_ID}">';</script></head></html>`,
    `<html><head><link rel="canonical" href="https://evil.test/channel/${ID}"></head></html>`,
    `<html><head><link rel="canonical" href="/channel/${ID}"><meta property="og:url" content="/channel/${OTHER_ID}"></head></html>`,
  ])('rejects missing, unrelated, or conflicting IDs', (html) => {
    expect(() => parseYoutubeChannelId(html, PAGE)).toThrow('YouTube channel ID is missing or inconsistent');
  });

  it('rejects a permanent redirect that conflicts with page metadata', () => {
    expect(() => parseYoutubeChannelId(metadata, new URL(`https://www.youtube.com/channel/${OTHER_ID}`)))
      .toThrow('YouTube channel ID is missing or inconsistent');
  });

  it.each(['https://consent.youtube.com/', 'https://www.youtube.com/watch?v=video', 'https://evil.test/@example'])('rejects non-channel redirects to %s', async (redirect) => {
    vi.mocked(fetchHtml).mockResolvedValue({ html: metadata, url: new URL(redirect) });
    await expect(resolveYoutubeChannel(PAGE.href)).rejects.toMatchObject({ kind: 'youtube_channel_unresolved' });
  });

  it.each(['HTTP 404', 'timeout', 'body limit', 'not HTML'])('propagates fetch failure: %s', async (message) => {
    vi.mocked(fetchHtml).mockRejectedValue(new PreviewError(message, 'fetch_failed'));
    await expect(resolveYoutubeChannel(PAGE.href)).rejects.toThrow(message);
    expect(fetchHtml).toHaveBeenCalledOnce();
  });

  it('rejects non-channel input before fetching', async () => {
    await expect(resolveYoutubeChannel('https://example.com/@example')).rejects.toMatchObject({ kind: 'invalid_url' });
    expect(fetchHtml).not.toHaveBeenCalled();
  });
});

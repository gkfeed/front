import { Readable } from 'node:stream';
import type { IncomingMessage, IncomingHttpHeaders } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestPublicHttp, type PublicHttpResponse } from '../publicHttp.js';
import { createDetachedRequestExecutionContext } from '../application/requestExecutionContext.js';
import { fetchVkHtml } from './vkFetcher.js';

vi.mock('../publicHttp.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../publicHttp.js')>(),
  requestPublicHttp: vi.fn(),
}));

const post = new URL('https://vk.com/wall-182864292_1336279');
const challenge = '/challenge.html?hash429=challenge&redirect=/wall-182864292_1336279';
const challengeHtml = `var codes = [[(function(){return 65;})]];var token = '';`;

function response(status: number, html = '', headers: IncomingHttpHeaders = {}): PublicHttpResponse {
  return {
    status,
    url: post,
    body: Readable.from([Buffer.from(html)]) as IncomingMessage,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  };
}

beforeEach(() => vi.mocked(requestPublicHttp).mockReset());

describe('fetchVkHtml', () => {
  it('recovers a challenged wall post and keeps clearance cookies across redirects', async () => {
    const context = createDetachedRequestExecutionContext();
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response(302, '', { location: challenge, 'set-cookie': ['hitw429=1; Path=/'] }))
      .mockResolvedValueOnce(response(200, challengeHtml))
      .mockResolvedValueOnce(response(302, '', {
        location: '/wall-182864292_1336279?s429=private-clearance',
        'set-cookie': ['solution429=clearance; Path=/; HttpOnly', 'session=ignored; Path=/'],
      }))
      .mockResolvedValueOnce(response(200, '<meta property="og:video" content="/video_ext.php?oid=-1&id=2">'));

    const page = await fetchVkHtml(post, context);
    expect(page.url.href).toBe(post.href);
    expect(page.html).toContain('og:video');
    const calls = vi.mocked(requestPublicHttp).mock.calls;
    expect(calls[2]?.[0].searchParams.get('key')).toMatch(/^[a-f0-9]{32}$/);
    expect(calls[3]?.[1].cookie).toBe('hitw429=1; solution429=clearance');
    expect(calls.every((call) => call[2] === context)).toBe(true);
  });

  it('isolates cookies when VK redirects from .com to .ru', async () => {
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response(302, '', {
        location: 'https://vk.ru/wall-182864292_1336279',
        'set-cookie': ['solution429=com-clearance; Domain=vk.ru; Path=/'],
      }))
      .mockResolvedValueOnce(response(200, '<title>Post</title>'));
    await fetchVkHtml(post);
    expect(vi.mocked(requestPublicHttp).mock.calls[1]?.[1].cookie).toBeUndefined();
  });

  it('removes expired clearance cookies', async () => {
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response(302, '', {
        location: challenge, 'set-cookie': ['solution429=old; Path=/'],
      }))
      .mockResolvedValueOnce(response(200, challengeHtml, { 'set-cookie': ['solution429=deleted; Path=/'] }))
      .mockResolvedValueOnce(response(302, '', { location: post.href }))
      .mockResolvedValueOnce(response(200, '<title>Post</title>'));
    await fetchVkHtml(post);
    expect(vi.mocked(requestPublicHttp).mock.calls[2]?.[1].cookie).toBeUndefined();
  });

  it('decodes the Windows-1251 response used by VK crawler pages', async () => {
    const page = response(200, '', { 'content-type': 'text/html; charset=windows-1251' });
    page.body = Readable.from([Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])]) as IncomingMessage;
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page);
    expect((await fetchVkHtml(post)).html).toBe('Привет');
  });

  it('reads wall post metadata without downloading an oversized body', async () => {
    const page = response(200);
    page.body = Readable.from([
      Buffer.from('<html><head><meta property="og:image" content="https://example.com/post.jpg"></head>'),
      Buffer.alloc(1_000_001, 120),
    ]) as IncomingMessage;
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(page);

    await expect(fetchVkHtml(post)).resolves.toMatchObject({
      html: '<html><head><meta property="og:image" content="https://example.com/post.jpg"></head>',
    });
  });

  it('reads VK video embed data after the head', async () => {
    const embed = new URL('https://vk.ru/video_ext.php?oid=-1&id=2');
    const html = '<html><head></head><body>"url720":"https://cdn.example/video.mp4"</body></html>';
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(200, html));

    await expect(fetchVkHtml(embed)).resolves.toMatchObject({ html });
  });

  it('returns VK missing-page HTML for wall posts', async () => {
    const html = '<div data-testid="page_not_found_placeholder"></div>';
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(404, html));

    await expect(fetchVkHtml(post)).resolves.toMatchObject({ html });
  });

  it('rejects unrecognized VK 404 responses', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(404, '<h1>Not found</h1>'));

    await expect(fetchVkHtml(post)).rejects.toMatchObject({ kind: 'upstream_error' });
  });

  it('rejects unknown challenges instead of returning an empty successful preview', async () => {
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response(302, '', { location: challenge }))
      .mockResolvedValueOnce(response(200, '<title>Verification required</title>'));
    await expect(fetchVkHtml(post)).rejects.toMatchObject({ kind: 'upstream_challenge' });
  });

  it('bounds repeated challenges', async () => {
    vi.mocked(requestPublicHttp)
      .mockResolvedValueOnce(response(302, '', { location: challenge }))
      .mockImplementation(async () => response(200, challengeHtml));
    await expect(fetchVkHtml(post)).rejects.toMatchObject({ kind: 'upstream_challenge' });
    expect(requestPublicHttp).toHaveBeenCalledTimes(5);
  });

  it.each(['https://example.com/', 'http://127.0.0.1/', 'https://vk.com.evil.example/', 'file:///etc/passwd'])(
    'rejects unsafe redirects to %s before sending a request', async (location) => {
      vi.mocked(requestPublicHttp).mockResolvedValueOnce(response(302, '', { location }));
      await expect(fetchVkHtml(post)).rejects.toThrow();
      expect(requestPublicHttp).toHaveBeenCalledTimes(1);
    },
  );

  it('bounds redirect loops', async () => {
    vi.mocked(requestPublicHttp).mockImplementation(async () => response(302, '', { location: post.href }));
    await expect(fetchVkHtml(post)).rejects.toMatchObject({ kind: 'too_many_redirects' });
    expect(requestPublicHttp).toHaveBeenCalledTimes(12);
  });
});

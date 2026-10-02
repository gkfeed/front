import { Readable } from 'node:stream';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { requestPublicHttp } from '../publicHttp.js';
import { fetchSasflixMedia } from './sasflixMedia.js';

vi.mock('../publicHttp.js', () => ({ requestPublicHttp: vi.fn() }));

const context = {
  signal: new AbortController().signal,
  deadline: Number.POSITIVE_INFINITY,
  remainingMs: () => 8_000,
} satisfies RequestExecutionContext;

const videoId = '1117fcdd-7b1f-4050-9c5d-3134c0d778ad';

describe('Sasflix media proxy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rewrites playlist resources through the same-origin media route', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from([
        `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=781559\n${videoId}/240\n`,
      ]),
      headers: { 'content-type': 'audio/mpegurl' },
      status: 200,
      url: new URL(`https://sasflix.ru/api/video/${videoId}.m3u8`),
    } as never);

    const media = await fetchSasflixMedia(
      `https://sasflix.ru/api/video/${videoId}.m3u8`,
      undefined,
      context,
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of media.body) chunks.push(Buffer.from(chunk));
    const playlist = Buffer.concat(chunks).toString();

    expect(media).toMatchObject({
      contentType: 'application/vnd.apple.mpegurl',
      status: 200,
    });
    expect(playlist).toContain(
      `/bff/sasflix-media?url=${encodeURIComponent(`https://sasflix.ru/api/video/${videoId}/240`)}`,
    );
  });

  it('rewrites URI attributes in HLS tags, including keys and initialization segments', async () => {
    const keyUrl = 'https://mirror.sasflix.ru/sasflix/a/encryption.key?signature=signed';
    const mapUrl = 'https://media.sasflix.ru/sasflix/a/init.mp4?signature=signed';
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from([
        `#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="${keyUrl}"\n#EXT-X-MAP:URI="${mapUrl}"\n`,
      ]),
      headers: { 'content-type': 'audio/mpegurl' },
      status: 200,
      url: new URL(`https://sasflix.ru/api/video/${videoId}.m3u8`),
    } as never);

    const media = await fetchSasflixMedia(`https://sasflix.ru/api/video/${videoId}.m3u8`, undefined, context);
    const chunks: Uint8Array[] = [];
    for await (const chunk of media.body) chunks.push(Buffer.from(chunk));
    const playlist = Buffer.concat(chunks).toString();

    expect(playlist).toContain(`URI="/bff/sasflix-media?url=${encodeURIComponent(keyUrl)}"`);
    expect(playlist).toContain(`URI="/bff/sasflix-media?url=${encodeURIComponent(mapUrl)}"`);
    expect(playlist).not.toContain('URI="https://');
  });

  it('rewrites Sasflix subtitle playlists and serves their WebVTT resource', async () => {
    const videoUrl = `https://sasflix.ru/api/video/${videoId}`;
    vi.mocked(requestPublicHttp).mockResolvedValueOnce({
      body: Readable.from([`#EXTM3U\n#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",URI="${videoId}/subtitle"\n`]),
      headers: { 'content-type': 'audio/mpegurl' },
      status: 200,
      url: new URL(`${videoUrl}.m3u8`),
    } as never).mockResolvedValueOnce({
      body: Readable.from(['#EXTM3U\n#EXTINF:10\nsubtitle.vtt\n#EXT-X-ENDLIST\n']),
      headers: { 'content-type': 'audio/mpegurl' },
      status: 200,
      url: new URL(`${videoUrl}/subtitle`),
    } as never).mockResolvedValueOnce({
      body: Readable.from(['WEBVTT\n\n00:00.000 --> 00:01.000\nHello\n']),
      headers: { 'content-type': 'text/vtt;charset=UTF-8' },
      status: 200,
      url: new URL(`${videoUrl}/subtitle.vtt`),
    } as never);

    const master = await fetchSasflixMedia(`${videoUrl}.m3u8`, undefined, context);
    const masterText = await streamText(master.body);
    expect(masterText).toContain(`URI="/bff/sasflix-media?url=${encodeURIComponent(`${videoUrl}/subtitle`)}"`);

    const subtitles = await fetchSasflixMedia(`${videoUrl}/subtitle`, undefined, context);
    expect(await streamText(subtitles.body)).toContain(
      `/bff/sasflix-media?url=${encodeURIComponent(`${videoUrl}/subtitle.vtt`)}`,
    );

    const vtt = await fetchSasflixMedia(`${videoUrl}/subtitle.vtt`, undefined, context);
    expect(vtt.contentType).toBe('text/vtt');
    expect(await streamText(vtt.body)).toContain('WEBVTT');
  });

  it('rejects HLS URI attributes outside the Sasflix media allowlist', async () => {
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from(['#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key"\n']),
      headers: { 'content-type': 'audio/mpegurl' },
      status: 200,
      url: new URL(`https://sasflix.ru/api/video/${videoId}.m3u8`),
    } as never);

    await expect(fetchSasflixMedia(`https://sasflix.ru/api/video/${videoId}.m3u8`, undefined, context))
      .rejects.toMatchObject({ kind: 'invalid_sasflix_media' });
  });

  it('serves a bounded binary HLS key through the media proxy', async () => {
    const key = new Uint8Array([1, 2, 3, 4]);
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body: Readable.from([key]),
      headers: { 'content-type': 'application/octet-stream' },
      status: 200,
      url: new URL('https://mirror.sasflix.ru/sasflix/a/encryption.key'),
    } as never);

    const media = await fetchSasflixMedia(
      'https://mirror.sasflix.ru/sasflix/a/encryption.key', undefined, context,
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of media.body) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(key));
    expect(media).toMatchObject({ contentType: 'application/octet-stream', contentLength: '4' });
  });

  it('proxies signed mirror segments and forwards byte ranges', async () => {
    const body = Readable.from([new Uint8Array([1, 2, 3])]);
    vi.mocked(requestPublicHttp).mockResolvedValue({
      body,
      headers: {
        'accept-ranges': 'bytes',
        'content-length': '3',
        'content-range': 'bytes 0-2/100',
        'content-type': 'video/mp2t',
      },
      status: 206,
      url: new URL('https://mirror.sasflix.ru/sasflix/a/video.ts?signature=signed'),
    } as never);

    await expect(fetchSasflixMedia(
      'https://mirror.sasflix.ru/sasflix/a/video.ts?signature=signed',
      'bytes=0-2',
      context,
    )).resolves.toMatchObject({
      body,
      contentLength: '3',
      contentRange: 'bytes 0-2/100',
      contentType: 'video/mp2t',
      status: 206,
    });
    expect(requestPublicHttp).toHaveBeenCalledWith(
      new URL('https://mirror.sasflix.ru/sasflix/a/video.ts?signature=signed'),
      expect.objectContaining({ range: 'bytes=0-2' }),
      context,
      { streamBody: true },
    );
  });

  it.each(['media.sasflix.ru', 'mirror.sasflix.ru', 'reflector.sasflix.ru'])(
    'accepts the rotating Sasflix segment host %s',
    async (host) => {
      vi.mocked(requestPublicHttp).mockResolvedValue({
        body: Readable.from([new Uint8Array([1])]),
        headers: { 'content-type': 'video/mp2t' },
        status: 200,
        url: new URL(`https://${host}/sasflix/a/video.ts?signature=signed`),
      } as never);

      await expect(fetchSasflixMedia(
        `https://${host}/sasflix/a/video.ts?signature=signed`,
        undefined,
        context,
      )).resolves.toMatchObject({ contentType: 'video/mp2t' });
    },
  );

  it.each([
    'https://example.com/video.m3u8',
    'http://sasflix.ru/api/video/1117fcdd-7b1f-4050-9c5d-3134c0d778ad.m3u8',
    'https://sasflix.ru/api/video/not-a-uuid.m3u8',
    'https://mirror.sasflix.ru/private/file.ts',
  ])('rejects media outside the Sasflix HLS contract: %s', async (url) => {
    await expect(fetchSasflixMedia(url, undefined, context))
      .rejects.toMatchObject({ kind: 'invalid_sasflix_media' });
    expect(requestPublicHttp).not.toHaveBeenCalled();
  });
});

async function streamText(body: Readable): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

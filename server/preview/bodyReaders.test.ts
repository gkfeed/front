import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import type { PublicHttpResponse } from '../publicHttp.js';
import {
  readLimitedBody,
  readLimitedBytes,
  readLimitedJson,
  responseTooLarge,
} from './bodyReaders.js';

describe('body readers', () => {
  it('destroys a pending body when the request context is aborted', async () => {
    const controller = new AbortController();
    const response = responseFromPendingBody();
    const context = {
      signal: controller.signal,
      deadline: Date.now() + 10_000,
      timedOut: false,
      clientAborted: false,
      remainingMs: (maximum = Number.POSITIVE_INFINITY) => maximum,
    };

    const pending = readLimitedBody(response, { context });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ reason: 'aborted' });
    expect(response.body.destroyed).toBe(true);
  });

  it('rejects a body that exceeds the byte limit while streaming', async () => {
    const response = responseFrom([Buffer.from('abc'), Buffer.from('def')]);

    await expect(readLimitedBytes(response, 5)).rejects.toMatchObject({
      kind: 'image_too_large',
    });
    expect(response.body.destroyed).toBe(true);
  });

  it('rejects a declared body that exceeds the limit before reading it', async () => {
    const response = responseFrom([Buffer.from('body')], { 'content-length': '4' });

    await expect(readLimitedBody(response, { maxBytes: 3 })).rejects.toEqual(responseTooLarge());
    expect(response.body.destroyed).toBe(true);
  });

  it('truncates text at a UTF-8 boundary without a replacement character', async () => {
    const response = responseFrom([Buffer.from('hello 🌍')]);

    await expect(readLimitedBody(response, {
      maxBytes: Buffer.byteLength('hello ') + 1,
      truncateAtLimit: true,
    })).resolves.toBe('hello ');
  });

  it('decodes legacy Cyrillic pages using the declared charset', async () => {
    const response = responseFrom([
      Uint8Array.from([0xCF, 0xF0, 0xE8, 0xE2, 0xE5, 0xF2]),
    ]);

    await expect(readLimitedBody(response, {
      encoding: 'windows-1251',
    })).resolves.toBe('Привет');
  });

  it('does not count compressed bytes against the decoded limit', async () => {
    const body = Buffer.from('{"ok":true}');
    const response = responseFrom([gzipSync(body)], { 'content-encoding': 'gzip' });

    await expect(readLimitedJson(response, {
      maximumBytes: body.byteLength,
      tooLarge: () => responseTooLarge(),
      invalidJson: () => new Error('invalid json'),
    })).resolves.toEqual({ ok: true });
  });
});

function responseFrom(
  chunks: Array<string | Uint8Array>,
  headers: Record<string, string> = {},
): PublicHttpResponse {
  return {
    body: Readable.from(chunks),
    headers,
    status: 200,
    url: new URL('https://example.com/'),
  };
}

function responseFromPendingBody(): PublicHttpResponse {
  return {
    body: new Readable({ read() {} }),
    headers: {},
    status: 200,
    url: new URL('https://example.com/'),
  };
}

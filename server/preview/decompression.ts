import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from 'node:zlib';
import type { Readable } from 'node:stream';

export function getDecodedBody(
  body: Readable,
  contentEncoding: string | string[] | undefined,
): Readable {
  const encoding = firstHeader(contentEncoding)?.trim().toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return body.pipe(createGunzip());
  if (encoding === 'deflate') return body.pipe(createInflate());
  if (encoding === 'br') return body.pipe(createBrotliDecompress());
  return body;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

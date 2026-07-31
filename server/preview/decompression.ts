import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from 'node:zlib';
import type { Readable } from 'node:stream';
import { firstHeader } from './headers.js';

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

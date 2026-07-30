import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from 'node:zlib';

import type { PublicHttpResponse } from '../publicHttp.js';
import { PreviewError } from './errors.js';

export const MAX_RESPONSE_BYTES = 1_000_000;
export const MAX_METADATA_RESPONSE_BYTES = 256_000;
export const MAX_IMAGE_RESPONSE_BYTES = 10_000_000;

export async function readLimitedBody(
  response: PublicHttpResponse,
  options: {
    maxBytes?: number;
    stopAfterHead?: boolean;
    truncateAtLimit?: boolean;
  } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > maxBytes && !options.truncateAtLimit) {
    response.body.destroy();
    throw responseTooLarge();
  }

  const body = getDecodedBody(response);
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';

  for await (const chunk of body) {
    const value = toBytes(chunk);
    const remainingBytes = maxBytes - size;
    if (value.byteLength > remainingBytes) {
      if (!options.truncateAtLimit) {
        body.destroy();
        throw responseTooLarge();
      }
      result += decoder.decode(value.subarray(0, Math.max(0, remainingBytes)), { stream: true });
      body.destroy();
      return result + decoder.decode();
    }
    size += value.byteLength;
    result += decoder.decode(value, { stream: true });
    if (options.stopAfterHead) {
      const headEnd = result.search(/<\/head\s*>/i);
      if (headEnd !== -1) {
        const endTagEnd = result.indexOf('>', headEnd) + 1;
        body.destroy();
        return result.slice(0, endTagEnd);
      }
    }
  }
  return result + decoder.decode();
}

export async function readLimitedBytes(
  response: PublicHttpResponse,
  maximumBytes: number,
): Promise<Uint8Array> {
  return readLimitedBuffer(response, maximumBytes, imageTooLarge);
}

export async function readLimitedJson(
  response: PublicHttpResponse,
  options: {
    maximumBytes: number;
    tooLarge: () => PreviewError;
    invalidJson: () => PreviewError;
  },
): Promise<unknown> {
  const buffer = await readLimitedBuffer(response, options.maximumBytes, options.tooLarge);
  try {
    return JSON.parse(Buffer.from(buffer).toString('utf8'));
  } catch {
    throw options.invalidJson();
  }
}

export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function responseTooLarge(): PreviewError {
  return new PreviewError('The remote page is too large to preview', 422, 'response_too_large');
}

async function readLimitedBuffer(
  response: PublicHttpResponse,
  maximumBytes: number,
  tooLarge: () => PreviewError,
): Promise<Uint8Array> {
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > maximumBytes) {
    response.body.destroy();
    throw tooLarge();
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    const value = toBytes(chunk);
    size += value.byteLength;
    if (size > maximumBytes) {
      response.body.destroy();
      throw tooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function toBytes(chunk: string | Uint8Array): Uint8Array {
  return typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
}

function getDecodedBody(response: PublicHttpResponse) {
  const encoding = firstHeader(response.headers['content-encoding'])?.trim().toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.body.pipe(createGunzip());
  if (encoding === 'deflate') return response.body.pipe(createInflate());
  if (encoding === 'br') return response.body.pipe(createBrotliDecompress());
  return response.body;
}

function imageTooLarge(): PreviewError {
  return new PreviewError('The Reddit preview image is too large', 422, 'image_too_large');
}

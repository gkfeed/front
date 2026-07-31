import type { Readable } from 'node:stream';

import type { PublicHttpResponse } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import { getDecodedBody } from './decompression.js';
import { firstHeader } from './headers.js';
import {
  readBoundedBytes,
  readBoundedText,
  type BoundedStream,
} from './boundedStreamReader.js';

export async function readLimitedBody(
  response: PublicHttpResponse,
  options: {
    maxBytes?: number;
    encoding?: string;
    stopAfterHead?: boolean;
    truncateAtLimit?: boolean;
  } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, maxBytes, responseTooLarge, options.truncateAtLimit === true);

  return readBoundedText(body as BoundedStream, {
    maximumBytes: maxBytes,
    encoding: options.encoding,
    stopAfterHead: options.stopAfterHead,
    truncateAtLimit: options.truncateAtLimit,
    tooLarge: responseTooLarge,
    onLimit: () => destroyBody(response, body),
  });
}

export async function readLimitedBytes(
  response: PublicHttpResponse,
  maximumBytes: number,
): Promise<Uint8Array> {
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, maximumBytes, imageTooLarge);
  return readBoundedBytes(
    body as BoundedStream,
    maximumBytes,
    imageTooLarge,
    () => destroyBody(response, body),
  );
}

export async function readLimitedJson(
  response: PublicHttpResponse,
  options: {
    maximumBytes: number;
    tooLarge: () => PreviewError;
    invalidJson: () => PreviewError;
  },
): Promise<unknown> {
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, options.maximumBytes, options.tooLarge);
  const buffer = await readBoundedBytes(
    body as BoundedStream,
    options.maximumBytes,
    options.tooLarge,
    () => destroyBody(response, body),
  );
  try {
    return JSON.parse(Buffer.from(buffer).toString('utf8'));
  } catch {
    throw options.invalidJson();
  }
}

export const MAX_RESPONSE_BYTES = 1_000_000;
export const MAX_METADATA_RESPONSE_BYTES = 256_000;
export const MAX_IMAGE_RESPONSE_BYTES = 10_000_000;

export function responseTooLarge(): PreviewError {
  return new PreviewError('The remote page is too large to preview', 422, 'response_too_large');
}

function rejectDeclaredLength(
  response: PublicHttpResponse,
  maximumBytes: number,
  tooLarge: () => Error,
  allowTruncation = false,
): void {
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > maximumBytes && !allowTruncation) {
    response.body.destroy();
    throw tooLarge();
  }
}

function destroyBody(response: PublicHttpResponse, body: Readable): void {
  body.destroy();
  if (body !== response.body) response.body.destroy();
}

function imageTooLarge(): PreviewError {
  return new PreviewError('The Reddit preview image is too large', 422, 'image_too_large');
}

import type { Readable } from 'node:stream';

import { PublicHttpError, discardResponseBody, type PublicHttpResponse } from '../publicHttp.js';
import { PreviewError } from './errors.js';
import { getDecodedBody } from './decompression.js';
import { firstHeader } from './headers.js';
import type { RequestContext } from '../requestContext.js';
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
    context?: RequestContext;
  } = {},
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_RESPONSE_BYTES;
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, maxBytes, responseTooLarge, options.truncateAtLimit === true);

  return readWithContext(response, body, options.context, () => readBoundedText(body as BoundedStream, {
    maximumBytes: maxBytes,
    encoding: options.encoding,
    stopAfterHead: options.stopAfterHead,
    truncateAtLimit: options.truncateAtLimit,
    tooLarge: responseTooLarge,
    onLimit: () => destroyBody(response, body),
  }));
}

export async function readLimitedBytes(
  response: PublicHttpResponse,
  maximumBytes: number,
  context?: RequestContext,
): Promise<Uint8Array> {
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, maximumBytes, imageTooLarge);
  return readWithContext(response, body, context, () => readBoundedBytes(
    body as BoundedStream,
    maximumBytes,
    imageTooLarge,
    () => destroyBody(response, body),
  ));
}

export async function readLimitedJson(
  response: PublicHttpResponse,
  options: {
    maximumBytes: number;
    tooLarge: () => PreviewError;
    invalidJson: () => PreviewError;
    context?: RequestContext;
  },
): Promise<unknown> {
  const body = getDecodedBody(response.body, response.headers['content-encoding']);
  rejectDeclaredLength(response, options.maximumBytes, options.tooLarge);
  const buffer = await readWithContext(response, body, options.context, () => readBoundedBytes(
    body as BoundedStream,
    options.maximumBytes,
    options.tooLarge,
    () => destroyBody(response, body),
  ));
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
    discardResponseBody(response.body);
    throw tooLarge();
  }
}

function destroyBody(response: PublicHttpResponse, body: Readable, error?: Error): void {
  body.destroy(error);
  if (body !== response.body) response.body.destroy(error);
}

function readWithContext<T>(
  response: PublicHttpResponse,
  body: Readable,
  context: RequestContext | undefined,
  read: () => Promise<T>,
): Promise<T> {
  if (!context) return read();

  const abortError = new PublicHttpError(context?.timedOut ? 'timeout' : 'aborted');
  const abort = () => destroyBody(response, body, abortError);
  if (context.signal.aborted) {
    abort();
    return Promise.reject(abortError);
  }
  context.signal.addEventListener('abort', abort, { once: true });
  return read().finally(() => context.signal.removeEventListener('abort', abort));
}

function imageTooLarge(): PreviewError {
  return new PreviewError('The Reddit preview image is too large', 422, 'image_too_large');
}

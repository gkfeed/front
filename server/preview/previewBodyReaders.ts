import { PublicHttpError, type PublicHttpResponse } from '../publicHttp.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import {
  MAX_IMAGE_RESPONSE_BYTES,
  MAX_METADATA_RESPONSE_BYTES,
  MAX_RESPONSE_BYTES,
  readLimitedBody,
  readLimitedBytes,
} from './bodyAdapters.js';
import { PreviewError } from './errors.js';

export async function readHtmlBody(
  response: PublicHttpResponse,
  options: {
    maxBytes?: number;
    encoding?: string;
    stopAfterHead?: boolean;
    truncateAtLimit?: boolean;
    context?: RequestExecutionContext;
  } = {},
): Promise<string> {
  return readPreviewBody(
    () => readLimitedBody(response, {
      maxBytes: options.maxBytes ?? MAX_RESPONSE_BYTES,
      encoding: options.encoding,
      stopAfterHead: options.stopAfterHead,
      truncateAtLimit: options.truncateAtLimit,
      context: options.context,
    }),
    {
      timeoutMessage: 'The remote page took too long to respond',
      failureMessage: 'The remote page could not be fetched',
      code: 'fetch_failed',
    },
  );
}

export function readMetadataBody(
  response: PublicHttpResponse,
  encoding?: string,
  context?: RequestExecutionContext,
): Promise<string> {
  return readHtmlBody(response, {
    maxBytes: MAX_METADATA_RESPONSE_BYTES,
    encoding,
    stopAfterHead: true,
    truncateAtLimit: true,
    context,
  });
}

export async function readImageBody(
  response: PublicHttpResponse,
  context?: RequestExecutionContext,
): Promise<Uint8Array> {
  return readPreviewBody(
    () => readLimitedBytes(response, MAX_IMAGE_RESPONSE_BYTES, context),
    {
      timeoutMessage: 'The Reddit preview image took too long to respond',
      failureMessage: 'The Reddit preview image could not be fetched',
      code: 'image_fetch_failed',
    },
  );
}

async function readPreviewBody<T>(
  read: () => Promise<T>,
  messages: {
    timeoutMessage: string;
    failureMessage: string;
    code: string;
  },
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? messages.timeoutMessage
      : messages.failureMessage;
    throw new PreviewError(message, messages.code);
  }
}

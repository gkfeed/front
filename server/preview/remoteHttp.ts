import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from 'node:zlib';

import type { PublicHttpResponse } from '../publicHttp.js';
import { PublicHttpError, requestPublicHttp } from '../publicHttp.js';
import { PreviewError } from './errors.js';

export const MAX_RESPONSE_BYTES = 1_000_000;
export const MAX_METADATA_RESPONSE_BYTES = 256_000;
export const MAX_IMAGE_RESPONSE_BYTES = 10_000_000;
const DEFAULT_MAX_REDIRECTS = 5;

export interface PublicResponseOptions {
  accept: string;
  userAgent: string;
  invalidRedirectMessage: string;
  tooManyRedirectsMessage: string;
  upstreamMessage: (status: number) => string;
  upstreamCode?: string;
  fetchFailedMessage: (timedOut: boolean) => string;
  fetchFailedCode: string;
  maxRedirects?: number;
}

export function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError('A valid URL is required', 400, 'invalid_url');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PreviewError('Only public HTTP and HTTPS URLs are allowed', 400, 'invalid_url');
  }
  return url;
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

export async function fetchPublicResponse(
  input: URL,
  options: PublicResponseOptions,
): Promise<PublicHttpResponse> {
  let url = input;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let response: PublicHttpResponse;
    try {
      response = await requestPublicHttp(url, {
        accept: options.accept,
        'user-agent': options.userAgent,
      });
    } catch (error) {
      throwPublicUrlError(error);
      throw new PreviewError(
        options.fetchFailedMessage(error instanceof PublicHttpError && error.reason === 'timeout'),
        502,
        options.fetchFailedCode,
      );
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError(options.invalidRedirectMessage, 502, 'invalid_redirect');
      if (redirects === maxRedirects) {
        throw new PreviewError(options.tooManyRedirectsMessage, 502, 'too_many_redirects');
      }
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(
        options.upstreamMessage(response.status),
        502,
        options.upstreamCode ?? 'upstream_error',
      );
    }

    return response;
  }

  throw new PreviewError(options.tooManyRedirectsMessage, 502, 'too_many_redirects');
}

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
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
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
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > maximumBytes) {
    response.body.destroy();
    throw imageTooLarge();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of response.body) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += value.byteLength;
    if (size > maximumBytes) {
      response.body.destroy();
      throw imageTooLarge();
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

export async function readLimitedJson(
  response: PublicHttpResponse,
  options: {
    maximumBytes: number;
    tooLarge: () => PreviewError;
    invalidJson: () => PreviewError;
  },
): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of response.body) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += value.byteLength;
    if (size > options.maximumBytes) {
      response.body.destroy();
      throw options.tooLarge();
    }
    chunks.push(value);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw options.invalidJson();
  }
}

export function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function throwPublicUrlError(error: unknown): void {
  if (!(error instanceof PublicHttpError)) return;
  if (error.reason === 'private') {
    throw new PreviewError('Private or local network URLs are not allowed', 403, 'private_url');
  }
  if (error.reason === 'unresolvable') {
    throw new PreviewError('The URL hostname could not be resolved', 422, 'unresolvable_host');
  }
}

export function responseTooLarge(): PreviewError {
  return new PreviewError('The remote page is too large to preview', 422, 'response_too_large');
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

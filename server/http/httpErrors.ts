/**
 * Errors raised while decoding an HTTP request or resolving a static asset.
 *
 * HTTP status/code metadata stays at the HTTP boundary; provider errors do
 * not need to know how they will be represented by a transport.
 */
export class HttpRequestError extends Error {
  readonly kind: string;

  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.kind = code;
    this.name = 'HttpRequestError';
  }
}

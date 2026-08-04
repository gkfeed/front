/** Internal preview/provider failure. HTTP status and response code are mapped at the HTTP boundary. */
export class PreviewError extends Error {
  constructor(
    message: string,
    readonly kind: string,
  ) {
    super(message);
    this.name = 'PreviewError';
  }
}

export function isPreviewError(error: unknown): error is PreviewError {
  return error instanceof PreviewError;
}

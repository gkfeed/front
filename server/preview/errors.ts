export class PreviewError extends Error {
  constructor(
    message: string,
    readonly kind: string,
  ) {
    super(message);
    this.name = 'PreviewError';
  }
}

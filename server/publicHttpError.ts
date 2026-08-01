export class PublicHttpError extends Error {
  constructor(readonly reason: 'network' | 'private' | 'timeout' | 'aborted' | 'unresolvable') {
    super(reason);
    this.name = 'PublicHttpError';
  }
}

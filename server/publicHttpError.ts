export class PublicHttpError extends Error {
  constructor(readonly reason: 'network' | 'private' | 'timeout' | 'unresolvable') {
    super(reason);
    this.name = 'PublicHttpError';
  }
}

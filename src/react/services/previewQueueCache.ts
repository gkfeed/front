import { PreviewRequest } from './previewQueueRequest';

/** Stores shared requests and owns expiration of completed preview values. */
export class PreviewCache {
  private readonly entries = new Map<string, PreviewRequest<unknown>>();

  get<T>(key: string): PreviewRequest<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.delete(key, entry);
      return undefined;
    }
    return entry as PreviewRequest<T>;
  }

  set<T>(key: string, entry: PreviewRequest<T>): void {
    this.entries.set(key, entry as PreviewRequest<unknown>);
  }

  delete<T>(key: string, entry: PreviewRequest<T>): void {
    if (this.entries.get(key) === entry) this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

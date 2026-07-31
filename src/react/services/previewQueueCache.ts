import { PreviewRequest, type PreviewRequestControl } from './previewQueueRequest';

/** Stores shared requests and owns expiration of completed preview values. */
export class PreviewCache {
  private readonly entries = new Map<string, PreviewRequestControl>();

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
    this.entries.set(key, entry);
  }

  delete(key: string, entry: PreviewRequestControl): void {
    if (this.entries.get(key) === entry) this.entries.delete(key);
  }

  clear(): PreviewRequestControl[] {
    const entries = [...this.entries.values()];
    this.entries.clear();
    return entries;
  }
}

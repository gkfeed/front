import { PreviewRequest, type PreviewRequestControl } from './previewQueueRequest';

const MAX_SETTLED_ENTRIES = 200;

/** Stores shared requests and owns expiration of completed preview values. */
export class PreviewCache {
  private readonly entries = new Map<string, PreviewRequestControl>();
  private cleanupTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly maxSettledEntries = MAX_SETTLED_ENTRIES) {}

  get<T>(key: string): PreviewRequest<T> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.delete(key, entry);
      return undefined;
    }
    // Map insertion order doubles as the LRU order for completed values.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry as PreviewRequest<T>;
  }

  set<T>(key: string, entry: PreviewRequest<T>): void {
    this.entries.set(key, entry);
  }

  settled(): void {
    this.pruneExpired();
    this.enforceLimit();
    this.scheduleCleanup();
  }

  delete(key: string, entry: PreviewRequestControl): void {
    if (this.entries.get(key) === entry) {
      this.entries.delete(key);
      this.scheduleCleanup();
    }
  }

  clear(): PreviewRequestControl[] {
    const entries = [...this.entries.values()];
    this.entries.clear();
    if (this.cleanupTimer !== undefined) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = undefined;
    return entries;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  private enforceLimit(): void {
    let settledCount = 0;
    for (const entry of this.entries.values()) {
      if (entry.isSettled) settledCount += 1;
    }

    if (settledCount <= this.maxSettledEntries) return;
    for (const [key, entry] of this.entries) {
      if (!entry.isSettled) continue;
      this.entries.delete(key);
      settledCount -= 1;
      if (settledCount <= this.maxSettledEntries) return;
    }
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer !== undefined) clearTimeout(this.cleanupTimer);
    this.cleanupTimer = undefined;

    let nextExpiration = Infinity;
    for (const entry of this.entries.values()) {
      if (entry.expiresAt !== null) nextExpiration = Math.min(nextExpiration, entry.expiresAt);
    }
    if (!Number.isFinite(nextExpiration)) return;

    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = undefined;
      this.pruneExpired();
      this.scheduleCleanup();
    }, Math.max(0, nextExpiration - Date.now()));
  }
}

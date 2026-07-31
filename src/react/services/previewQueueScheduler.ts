import type { PreviewRequestControl } from './previewQueueRequest';

const MAX_CONCURRENT_PREVIEWS = 4;

/** Starts queued requests while keeping the network concurrency bounded. */
export class PreviewScheduler {
  private readonly queue: PreviewRequestControl[] = [];
  private readonly active = new Set<PreviewRequestControl>();

  enqueue(request: PreviewRequestControl): void {
    this.queue.push(request);
    this.runNext();
  }

  settled(request: PreviewRequestControl): void {
    if (this.active.delete(request)) this.runNext();
  }

  clear(): void {
    this.queue.length = 0;
  }

  private runNext(): void {
    while (this.active.size < MAX_CONCURRENT_PREVIEWS) {
      const next = this.queue.shift();
      if (!next) return;
      if (next.isSettled) continue;
      this.active.add(next);
      next.start();
    }
  }
}

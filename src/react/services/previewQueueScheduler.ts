import { PreviewRequest } from './previewQueueRequest';

const MAX_CONCURRENT_PREVIEWS = 4;

/** Starts queued requests while keeping the network concurrency bounded. */
export class PreviewScheduler {
  private readonly queue: Array<PreviewRequest<unknown>> = [];
  private readonly active = new Set<PreviewRequest<unknown>>();

  enqueue<T>(request: PreviewRequest<T>): void {
    this.queue.push(request as PreviewRequest<unknown>);
    this.runNext();
  }

  settled<T>(request: PreviewRequest<T>): void {
    if (this.active.delete(request as PreviewRequest<unknown>)) this.runNext();
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

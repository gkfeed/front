import type { PreviewRequestControl } from './previewQueueRequest';

const MAX_CONCURRENT_PREVIEWS = 4;

/** Starts queued requests while keeping the network concurrency bounded. */
export class PreviewScheduler {
  private readonly queue: Array<{ request: PreviewRequestControl; priority: number }> = [];
  private readonly active = new Set<PreviewRequestControl>();

  enqueue(request: PreviewRequestControl, priority: number): void {
    this.queue.push({ request, priority });
    this.runNext();
  }

  reprioritize(request: PreviewRequestControl, priority: number, onlyPromote = false): void {
    const queued = this.queue.find((entry) => entry.request === request);
    if (queued) queued.priority = onlyPromote ? Math.min(queued.priority, priority) : priority;
  }

  settled(request: PreviewRequestControl): void {
    if (this.active.delete(request)) this.runNext();
  }

  clear(): void {
    this.queue.length = 0;
  }

  private runNext(): void {
    while (this.active.size < MAX_CONCURRENT_PREVIEWS) {
      if (this.queue.length === 0) return;
      let best = 0;
      for (let index = 1; index < this.queue.length; index += 1) {
        if (this.queue[index]!.priority < this.queue[best]!.priority) best = index;
      }
      const next = this.queue.splice(best, 1)[0]!.request;
      if (next.isSettled) continue;
      this.active.add(next);
      next.start();
    }
  }
}

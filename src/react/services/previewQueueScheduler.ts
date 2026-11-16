import type { PreviewRequestControl } from './previewQueueRequest';

const MAX_CONCURRENT_PREVIEWS = 4;
// The BFF permits two simultaneous requests per client. Reserve one for the visible card.
const MAX_BACKGROUND_PREVIEWS = 1;

/** Starts queued requests while keeping the network concurrency bounded. */
export class PreviewScheduler {
  private readonly queue: Array<{ request: PreviewRequestControl; priority: number }> = [];
  private readonly active = new Map<PreviewRequestControl, number>();
  private backgroundTimer: ReturnType<typeof setTimeout> | undefined;

  enqueue(request: PreviewRequestControl, priority: number): void {
    // A visible-only request has no prefetch priority to fall back to.
    this.queue.push({ request, priority: priority === 0 ? Infinity : priority });
    if (priority === 0) {
      this.runNext();
    } else {
      this.scheduleBackground();
    }
  }

  reprioritize(request: PreviewRequestControl, priority: number, onlyPromote = false): void {
    const queued = this.queue.find((entry) => entry.request === request);
    if (queued) queued.priority = onlyPromote ? Math.min(queued.priority, priority) : priority;
    const activePriority = this.active.get(request);
    if (activePriority !== undefined) this.active.set(request, onlyPromote ? Math.min(activePriority, priority) : priority);
    if (this.queue.length > 0) this.scheduleBackground();
  }

  wake(): void {
    this.runNext();
  }

  settled(request: PreviewRequestControl): void {
    if (this.active.delete(request)) this.runNext();
  }

  clear(): void {
    if (this.backgroundTimer !== undefined) clearTimeout(this.backgroundTimer);
    this.backgroundTimer = undefined;
    this.queue.length = 0;
  }

  private scheduleBackground(): void {
    if (this.backgroundTimer !== undefined) return;
    // Batch speculative candidates so the nearest queued item starts first.
    this.backgroundTimer = setTimeout(() => {
      this.backgroundTimer = undefined;
      this.runNext();
    }, 0);
  }

  private runNext(): void {
    while (this.active.size < MAX_CONCURRENT_PREVIEWS) {
      if (this.queue.length === 0) return;
      let best = 0;
      for (let index = 1; index < this.queue.length; index += 1) {
        const candidate = this.queue[index]!;
        const current = this.queue[best]!;
        const candidatePriority = candidate.request.hasForegroundSubscriber ? 0 : candidate.priority;
        const currentPriority = current.request.hasForegroundSubscriber ? 0 : current.priority;
        if (candidatePriority < currentPriority) best = index;
      }
      const selected = this.queue[best]!;
      if (selected.request.isSettled) { this.queue.splice(best, 1); continue; }
      // Leave room for a newly visible item while background requests are slow.
      const background = [...this.active].filter(([request]) => !request.hasForegroundSubscriber);
      if (!selected.request.hasForegroundSubscriber && background.length >= MAX_BACKGROUND_PREVIEWS) {
        const [running, runningPriority] = background.reduce((worst, entry) => entry[1] > worst[1] ? entry : worst);
        if (runningPriority <= selected.priority || !running.suspend()) return;
        this.active.delete(running);
        this.queue.push({ request: running, priority: runningPriority });
      }
      const next = this.queue.splice(best, 1)[0]!;
      this.active.set(next.request, next.priority);
      next.request.start();
    }
  }
}

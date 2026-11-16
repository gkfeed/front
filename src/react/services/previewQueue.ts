import { PreviewCache } from './previewQueueCache';
import { PreviewRequest, type PreviewLoader } from './previewQueueRequest';
import { PreviewScheduler } from './previewQueueScheduler';

class PreviewQueue {
  private readonly cache = new PreviewCache();
  private readonly scheduler = new PreviewScheduler();

  load<T>(key: string, load: PreviewLoader<T>, signal?: AbortSignal, priority = 0, cacheTtlMs?: number): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) {
      if (priority > 0 && !signal?.aborted) this.scheduler.reprioritize(cached, priority, true);
      const subscribed = cached.subscribe(signal, priority === 0);
      if (priority === 0) this.scheduler.wake();
      return subscribed;
    }

    const request = new PreviewRequest<T>(key, load, (settled, failed) => {
      this.scheduler.settled(settled);
      if (failed) this.cache.delete(key, settled);
      else this.cache.settled();
    }, cacheTtlMs);
    this.cache.set(key, request);

    const subscribed = request.subscribe(signal, priority === 0);
    this.scheduler.enqueue(request, priority);
    return subscribed;
  }

  peek<T>(key: string): { value: T } | undefined {
    return this.cache.peek<T>(key);
  }

  state(key: string): 'missing' | 'pending' | 'settled' {
    const request = this.cache.get(key);
    return request ? request.isSettled ? 'settled' : 'pending' : 'missing';
  }

  reprioritize(key: string, priority: number): void {
    const cached = this.cache.get(key);
    if (cached && priority > 0) this.scheduler.reprioritize(cached, priority);
  }

  clear(): void {
    // Stop queued work before cancelling active loads, whose completion drains the queue.
    this.scheduler.clear();
    for (const request of this.cache.clear()) request.cancel();
  }
}

const previewQueue = new PreviewQueue();

export function loadQueuedPreview<T>(
  key: string,
  load: PreviewLoader<T>,
  signal?: AbortSignal,
  priority = 0,
  cacheTtlMs?: number,
): Promise<T> {
  return previewQueue.load(key, load, signal, priority, cacheTtlMs);
}

export function peekQueuedPreview<T>(key: string): { value: T } | undefined {
  return previewQueue.peek<T>(key);
}

export function queuedPreviewState(key: string): 'missing' | 'pending' | 'settled' {
  return previewQueue.state(key);
}

export function reprioritizeQueuedPreview(key: string, priority: number): void {
  previewQueue.reprioritize(key, priority);
}

export function clearPreviewCache(): void {
  previewQueue.clear();
}

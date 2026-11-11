import { PreviewCache } from './previewQueueCache';
import { PreviewRequest, type PreviewLoader } from './previewQueueRequest';
import { PreviewScheduler } from './previewQueueScheduler';

class PreviewQueue {
  private readonly cache = new PreviewCache();
  private readonly scheduler = new PreviewScheduler();

  load<T>(key: string, load: PreviewLoader<T>, signal?: AbortSignal, priority = 0): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) {
      if (priority > 0 && !signal?.aborted) this.scheduler.reprioritize(cached, priority, true);
      return cached.subscribe(signal, priority === 0);
    }

    const request = new PreviewRequest<T>(key, load, (settled, failed) => {
      this.scheduler.settled(settled);
      if (failed) this.cache.delete(key, settled);
      else this.cache.settled();
    });
    this.cache.set(key, request);

    const subscribed = request.subscribe(signal, priority === 0);
    this.scheduler.enqueue(request, priority);
    return subscribed;
  }

  reprioritize(key: string, priority: number): void {
    const cached = this.cache.get(key);
    if (cached && priority > 0) this.scheduler.reprioritize(cached, priority);
  }

  clear(): void {
    for (const request of this.cache.clear()) request.cancel();
    this.scheduler.clear();
  }
}

const previewQueue = new PreviewQueue();

export function loadQueuedPreview<T>(
  key: string,
  load: PreviewLoader<T>,
  signal?: AbortSignal,
  priority = 0,
): Promise<T> {
  return previewQueue.load(key, load, signal, priority);
}

export function reprioritizeQueuedPreview(key: string, priority: number): void {
  previewQueue.reprioritize(key, priority);
}

export function clearPreviewCache(): void {
  previewQueue.clear();
}

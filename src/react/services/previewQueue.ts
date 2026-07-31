import { PreviewCache } from './previewQueueCache';
import { PreviewRequest, type PreviewLoader } from './previewQueueRequest';
import { PreviewScheduler } from './previewQueueScheduler';

class PreviewQueue {
  private readonly cache = new PreviewCache();
  private readonly scheduler = new PreviewScheduler();

  load<T>(key: string, load: PreviewLoader<T>, signal?: AbortSignal): Promise<T> {
    const cached = this.cache.get<T>(key);
    if (cached) return cached.subscribe(signal);

    const request = new PreviewRequest<T>(key, load, (settled, failed) => {
      this.scheduler.settled(settled);
      if (failed) this.cache.delete(key, settled);
    });
    this.cache.set(key, request);

    const subscribed = request.subscribe(signal);
    this.scheduler.enqueue(request);
    return subscribed;
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
): Promise<T> {
  return previewQueue.load(key, load, signal);
}

export function clearPreviewCache(): void {
  previewQueue.clear();
}

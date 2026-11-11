import { BffHttpError, BffResponseError } from './bffClient';
import { getLiquipediaMatchPreview } from './liquipedia';
import { getOpenGraphPreview } from './openGraph';
import { loadQueuedPreview, reprioritizeQueuedPreview } from './previewQueue';
import { retryRateLimitedPreview } from './retryRateLimitedPreview';
import type { RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';

export type { RemotePreview } from '../domain/feedItemCardContracts';

export async function loadRemotePreview(
  url: string,
  source: Exclude<RemotePreviewSource, 'none'>,
  signal: AbortSignal,
  priority = 0,
): Promise<RemotePreview> {
  if (source === 'liquipedia') {
    try {
      const liquipediaMatch = await loadQueuedPreview(
        `liquipedia:${url}`,
        (requestSignal) => retryRateLimitedPreview(
          () => getLiquipediaMatchPreview(url, requestSignal), requestSignal,
        ),
        signal,
        priority,
      );
      return { liquipediaMatch, openGraphPreview: null };
    } catch (error) {
      if (!isUnsupportedLiquipediaMarkupError(error)) throw error;
      // Unsupported or changed Liquipedia markup still gets a generic preview.
    }
  }

  const openGraphPreview = await loadQueuedPreview(
    `open-graph:${url}`,
    (requestSignal) => retryRateLimitedPreview(
      () => getOpenGraphPreview(url, requestSignal), requestSignal,
    ),
    signal,
    priority,
  );
  return { liquipediaMatch: null, openGraphPreview };
}

function isUnsupportedLiquipediaMarkupError(error: unknown): boolean {
  return (error instanceof BffResponseError && error.reason === 'invalid-shape')
    || (error instanceof BffHttpError && error.status === 422);
}

export function reprioritizeRemotePreview(url: string, source: Exclude<RemotePreviewSource, 'none'>, priority: number): void {
  reprioritizeQueuedPreview(`${source}:${url}`, priority);
  // Liquipedia can fall back to Open Graph after a failed request.
  if (source === 'liquipedia') reprioritizeQueuedPreview(`open-graph:${url}`, priority);
}

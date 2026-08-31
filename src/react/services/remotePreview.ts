import { BffHttpError, BffResponseError } from './bffClient';
import { getLiquipediaMatchPreview } from './liquipedia';
import { getOpenGraphPreview } from './openGraph';
import { loadQueuedPreview } from './previewQueue';
import type { RemotePreview, RemotePreviewSource } from '../domain/feedItemCardContracts';

export type { RemotePreview } from '../domain/feedItemCardContracts';

export async function loadRemotePreview(
  url: string,
  source: Exclude<RemotePreviewSource, 'none'>,
  signal: AbortSignal,
): Promise<RemotePreview> {
  if (source === 'liquipedia') {
    try {
      const liquipediaMatch = await loadQueuedPreview(
        `liquipedia:${url}`,
        (requestSignal) => getLiquipediaMatchPreview(url, requestSignal),
        signal,
      );
      return { liquipediaMatch, openGraphPreview: null };
    } catch (error) {
      if (!isUnsupportedLiquipediaMarkupError(error)) throw error;
      // Unsupported or changed Liquipedia markup still gets a generic preview.
    }
  }

  const openGraphPreview = await loadQueuedPreview(
    `open-graph:${url}`,
    (requestSignal) => getOpenGraphPreview(url, requestSignal),
    signal,
  );
  return { liquipediaMatch: null, openGraphPreview };
}

function isUnsupportedLiquipediaMarkupError(error: unknown): boolean {
  return (error instanceof BffResponseError && error.reason === 'invalid-shape')
    || (error instanceof BffHttpError && error.status === 422);
}

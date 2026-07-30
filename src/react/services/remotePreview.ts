import type { OpenGraphPreview } from './openGraph';
import { getLiquipediaMatchPreview, type LiquipediaMatchPreview } from './liquipedia';
import { getOpenGraphPreview } from './openGraph';
import { loadQueuedPreview } from './previewQueue';

export type RemotePreview = {
  liquipediaMatch: LiquipediaMatchPreview | null;
  openGraphPreview: OpenGraphPreview | null;
};

export const EMPTY_REMOTE_PREVIEW: RemotePreview = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

export async function loadRemotePreview(
  url: string,
  isLiquipedia: boolean,
  signal: AbortSignal,
): Promise<RemotePreview> {
  if (isLiquipedia) {
    try {
      const liquipediaMatch = await loadQueuedPreview(
        `liquipedia:${url}`,
        (requestSignal) => getLiquipediaMatchPreview(url, requestSignal),
        signal,
      );
      return { liquipediaMatch, openGraphPreview: null };
    } catch (error) {
      if (isAbortError(error)) throw error;
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

export function mergeHltvLiveData(
  next: OpenGraphPreview,
  previous: OpenGraphPreview | null,
): OpenGraphPreview {
  if (previous?.matchStatus === 'live' && next.matchStatus === 'scheduled') {
    return previous;
  }
  if (
    next.matchStatus !== 'live'
    || !previous
    || !sameMatchScore(next.matchScore, previous.matchScore)
  ) return next;

  return {
    ...next,
    matchCurrentMap: next.matchCurrentMap ?? previous.matchCurrentMap,
    matchCompletedMaps: next.matchCompletedMaps?.length
      ? next.matchCompletedMaps
      : previous.matchCompletedMaps,
    matchPlayerStats: next.matchPlayerStats ?? previous.matchPlayerStats,
    matchTeamSides: next.matchTeamSides ?? previous.matchTeamSides,
  };
}

function sameMatchScore(
  first: OpenGraphPreview['matchScore'],
  second: OpenGraphPreview['matchScore'],
): boolean {
  return Boolean(
    first
    && second
    && first[0] === second[0]
    && first[1] === second[1],
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

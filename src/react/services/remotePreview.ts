import type { HltvMatchSnapshot, OpenGraphPreview } from './openGraph';
import { BffHttpError, BffResponseError } from './bffClient';
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

export function mergeHltvLiveData(
  next: OpenGraphPreview,
  previous: OpenGraphPreview | null,
): OpenGraphPreview {
  const nextSnapshot = getHltvSnapshot(next);
  const previousSnapshot = previous ? getHltvSnapshot(previous) : null;
  if (!nextSnapshot) return next;

  if (previous && previousSnapshot?.status === 'live' && nextSnapshot.status === 'scheduled') {
    return previous;
  }
  if (
    !previous
    || nextSnapshot.status !== 'live'
    || !previousSnapshot
    || !sameMatchScore(nextSnapshot.score, previousSnapshot.score)
  ) return next;

  return {
    ...next,
    providerData: {
      provider: 'hltv',
      snapshot: {
        ...nextSnapshot,
        currentMap: nextSnapshot.currentMap ?? previousSnapshot.currentMap,
        completedMaps: nextSnapshot.completedMaps?.length
          ? nextSnapshot.completedMaps
          : previousSnapshot.completedMaps,
        playerStats: hasPlayerStats(nextSnapshot.playerStats)
          ? nextSnapshot.playerStats
          : previousSnapshot.playerStats,
        teamSides: nextSnapshot.teamSides ?? previousSnapshot.teamSides,
      },
    },
  };
}

function sameMatchScore(
  first: HltvMatchSnapshot['score'],
  second: HltvMatchSnapshot['score'],
): boolean {
  return Boolean(
    first
    && second
    && first[0] === second[0]
    && first[1] === second[1],
  );
}

function hasPlayerStats(snapshot: HltvMatchSnapshot['playerStats']): boolean {
  return Boolean(snapshot?.some((team) => team.length > 0));
}

function getHltvSnapshot(preview: OpenGraphPreview): HltvMatchSnapshot | null {
  return preview.providerData?.provider === 'hltv'
    ? preview.providerData.snapshot
    : null;
}

function isUnsupportedLiquipediaMarkupError(error: unknown): boolean {
  return (error instanceof BffResponseError && error.reason === 'invalid-shape')
    || (error instanceof BffHttpError && error.status === 422);
}

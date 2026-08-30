import type { HltvMatchSnapshot, OpenGraphPreview } from '../../../shared/previewContracts';

import type { RemotePreview } from './feedItemCardContracts';

export const EMPTY_REMOTE_PREVIEW: RemotePreview = {
  liquipediaMatch: null,
  openGraphPreview: null,
};

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

  const currentMapChanged = hasCurrentMapChanged(nextSnapshot, previousSnapshot);

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
        roundHistory: currentMapChanged
          ? nextSnapshot.currentMap && isZeroMapScore(nextSnapshot.currentMap.score)
            ? []
            : nextSnapshot.roundHistory ?? null
          : nextSnapshot.roundHistory?.length
            ? nextSnapshot.roundHistory
            : previousSnapshot.roundHistory,
        playerStats: hasPlayerStats(nextSnapshot.playerStats)
          ? nextSnapshot.playerStats
          : previousSnapshot.playerStats,
        teamSides: nextSnapshot.teamSides ?? previousSnapshot.teamSides,
      },
    },
  };
}

function hasCurrentMapChanged(
  next: HltvMatchSnapshot,
  previous: HltvMatchSnapshot,
): boolean {
  if (!next.currentMap || !previous.currentMap) return false;
  if (next.currentMap.name !== previous.currentMap.name) return true;

  return isZeroMapScore(next.currentMap.score)
    && !isZeroMapScore(previous.currentMap.score);
}

function isZeroMapScore(score: [string, string]): boolean {
  return score[0] === '0' && score[1] === '0';
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

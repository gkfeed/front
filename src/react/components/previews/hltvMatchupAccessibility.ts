import type { HltvMatchSnapshot, HltvMatchTeamPreview } from '../../../../shared/previewContracts';
import { isCompletedHltvMapScore } from './hltvPresentation';

type HltvMatchupAccessibilityMap = {
  name: string;
  score: [string, string];
};

export type HltvMatchupAccessibilityData = {
  firstTeam: string;
  secondTeam: string;
  score: {
    first: string;
    second: string;
    status: 'live' | 'final';
  } | null;
  currentMap: HltvMatchupAccessibilityMap | null;
  completedMaps: HltvMatchupAccessibilityMap[];
  sides: [string, string] | null;
};

export function getHltvMatchupAccessibilityData({
  teams,
  score,
  isLive,
  currentMap,
  completedMaps,
  teamSides,
}: {
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview];
  score: HltvMatchSnapshot['score'];
  isLive: boolean;
  currentMap: HltvMatchSnapshot['currentMap'];
  completedMaps: HltvMatchSnapshot['completedMaps'];
  teamSides: HltvMatchSnapshot['teamSides'];
}): HltvMatchupAccessibilityData {
  const visibleCompletedMaps = (completedMaps ?? []).filter(
    (map) => !currentMap || map.name !== currentMap.name,
  );
  const currentMapFinished = currentMap ? isCompletedHltvMapScore(currentMap.score) : false;

  return {
    firstTeam: teams[0].name,
    secondTeam: teams[1].name,
    score: score ? {
      first: score[0],
      second: score[1],
      status: isLive ? 'live' : 'final',
    } : null,
    currentMap: isLive && currentMap ? currentMap : null,
    completedMaps: visibleCompletedMaps,
    sides: isLive && teamSides && !currentMapFinished ? [
      `${teams[0].name} ${teamSides[0].toUpperCase()}`,
      `${teams[1].name} ${teamSides[1].toUpperCase()}`,
    ] : null,
  };
}

import type { HltvMatchSnapshot, HltvMatchTeamPreview } from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

import { getHltvMatchupAccessibilityData } from './hltvMatchupAccessibility';
import { HltvCountdown } from './HltvCountdown';
import { HltvPlayerStats } from './HltvPlayerStats';
import { HltvMatchupScore } from './HltvMatchupScore';

export function HltvMatchup({
  teams,
  href,
  snapshot,
}: {
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview];
  href: string;
  snapshot: HltvMatchSnapshot;
}) {
  const { t } = useTranslation();
  const { score, status, currentMap, completedMaps, playerStats, teamSides } = snapshot;
  const isLive = status === 'live';
  const isCompleted = status === 'over';
  const accessibility = getHltvMatchupAccessibilityData({
    teams,
    score,
    isLive,
    currentMap,
    completedMaps,
    teamSides,
  });
  const accessibleScore = accessibility.score
    ? `, ${t('hltv.score', {
      status: isLive ? t('hltv.statusLive') : t('hltv.statusFinal'),
      first: accessibility.score.first,
      second: accessibility.score.second,
    })}`
    : '';
  const accessibleMap = accessibility.currentMap
    ? `, ${t('hltv.currentMap', {
      name: accessibility.currentMap.name,
      first: accessibility.currentMap.score[0],
      second: accessibility.currentMap.score[1],
    })}`
    : '';
  const accessibleCompletedMaps = accessibility.completedMaps.length
    ? `, ${t('hltv.completedMaps', {
      maps: accessibility.completedMaps
        .map((map) => `${map.name} ${map.score[0]} ${t('hltv.to')} ${map.score[1]}`)
        .join(', '),
    })}`
    : '';
  const accessibleSides = accessibility.sides
    ? `, ${accessibility.sides.join(', ')}`
    : '';

  return (
    <div className="reader-card__hltv-live-card">
      <a
        className="reader-card__hltv-matchup"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${accessibility.firstTeam} ${t('hltv.versus')} ${accessibility.secondTeam}${accessibleScore}${accessibleMap}${accessibleCompletedMaps}${accessibleSides}`}
      >
        <HltvMatchupTeam team={teams[0]} />
        <HltvMatchupScore
          score={score}
          isLive={isLive}
          currentMap={currentMap}
          completedMaps={accessibility.completedMaps}
          teamSides={teamSides}
        />
        <HltvMatchupTeam team={teams[1]} />
      </a>
      {snapshot.startsAt ? <HltvCountdown startsAt={snapshot.startsAt} /> : null}
      {isLive || (isCompleted && playerStats?.some((team) => team.length > 0)) ? (
        <HltvPlayerStats
          teams={teams}
          playerStats={playerStats}
          currentMap={isLive ? currentMap : null}
          teamSides={teamSides}
          roundHistory={isLive ? snapshot.roundHistory : null}
          isFinal={isCompleted}
        />
      ) : null}
    </div>
  );
}

function HltvMatchupTeam({
  team,
}: {
  team: HltvMatchTeamPreview;
}) {
  return (
    <span className="reader-card__hltv-team">
      {team.logo ? (
        <img src={team.logo} alt="" />
      ) : (
        <span className="reader-card__hltv-monogram" aria-hidden="true">
          {team.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <strong>{team.name}</strong>
    </span>
  );
}

import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import { getHltvMapScoreClass, isCompletedHltvMapScore } from './hltvPresentation';

export function HltvMatchup({
  teams,
  href,
  score,
  isLive,
  currentMap,
  completedMaps,
  playerStats,
  teamSides,
}: {
  teams: NonNullable<OpenGraphPreview['matchTeams']>;
  href: string;
  score: OpenGraphPreview['matchScore'];
  isLive: boolean;
  currentMap: OpenGraphPreview['matchCurrentMap'];
  completedMaps: OpenGraphPreview['matchCompletedMaps'];
  playerStats: OpenGraphPreview['matchPlayerStats'];
  teamSides: OpenGraphPreview['matchTeamSides'];
}) {
  const accessibleScore = score
    ? `, ${isLive ? 'live' : 'final'} score ${score[0]} to ${score[1]}`
    : '';
  const accessibleMap = isLive && currentMap
    ? `, current map ${currentMap.name} ${currentMap.score[0]} to ${currentMap.score[1]}`
    : '';
  const visibleCompletedMaps = completedMaps?.filter(
    (map) => !currentMap || map.name !== currentMap.name,
  );
  const accessibleCompletedMaps = visibleCompletedMaps?.length
    ? `, completed maps ${visibleCompletedMaps
      .map((map) => `${map.name} ${map.score[0]} to ${map.score[1]}`)
      .join(', ')}`
    : '';
  const isCurrentMapFinished = currentMap
    ? isCompletedHltvMapScore(currentMap.score)
    : false;
  const accessibleSides = isLive && teamSides && !isCurrentMapFinished
    ? `, ${teams[0].name} ${teamSides[0].toUpperCase()}, ${teams[1].name} ${teamSides[1].toUpperCase()}`
    : '';

  return (
    <div className="reader-card__hltv-live-card">
      <a
        className="reader-card__hltv-matchup"
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`${teams[0].name} versus ${teams[1].name}${accessibleScore}${accessibleMap}${accessibleCompletedMaps}${accessibleSides}`}
      >
        <HltvMatchupTeam team={teams[0]} />
        {score ? (
          <span
            className={[
              'reader-card__hltv-score',
              isLive ? 'reader-card__hltv-score--live' : '',
            ].filter(Boolean).join(' ')}
            aria-live="polite"
            aria-atomic="true"
          >
            {isLive ? (
              <span className="reader-card__hltv-live-label">
                <i aria-hidden="true" /> Live
              </span>
            ) : null}
            <strong>{score[0]} : {score[1]}</strong>
            {visibleCompletedMaps?.map((map) => (
              <span className="reader-card__hltv-completed-map" key={map.name}>
                <b>{map.name}</b>
                <HltvMapScore score={map.score} teamSides={null} />
              </span>
            ))}
            {isLive && currentMap ? (
              <span className="reader-card__hltv-current-map">
                <b>{currentMap.name}</b>
                <HltvMapScore score={currentMap.score} teamSides={teamSides} />
              </span>
            ) : null}
          </span>
        ) : (
          <strong className="reader-card__hltv-versus">vs</strong>
        )}
        <HltvMatchupTeam team={teams[1]} />
      </a>
      {isLive ? <HltvPlayerStats teams={teams} playerStats={playerStats} /> : null}
    </div>
  );
}

function HltvMapScore({
  score,
  teamSides,
}: {
  score: [string, string];
  teamSides: OpenGraphPreview['matchTeamSides'];
}) {
  return (
    <span className="reader-card__hltv-current-map-score">
      <span className={getHltvMapScoreClass(score, 0, teamSides)}>{score[0]}</span>
      <i aria-hidden="true">:</i>
      <span className={getHltvMapScoreClass(score, 1, teamSides)}>{score[1]}</span>
    </span>
  );
}

function HltvPlayerStats({
  teams,
  playerStats,
}: {
  teams: NonNullable<OpenGraphPreview['matchTeams']>;
  playerStats: OpenGraphPreview['matchPlayerStats'];
}) {
  const hasPlayerStats = playerStats?.some((team) => team.length > 0);
  return (
    <details className="reader-card__hltv-player-stats">
      <summary>
        <span>Player stats</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      {hasPlayerStats && playerStats ? (
        <div className="reader-card__hltv-player-tables">
          {teams.map((team, teamIndex) => (
            <table key={team.name}>
              <caption>{team.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Player</th>
                  <th scope="col">K–D</th>
                  <th scope="col"><abbr title="Assists">A</abbr></th>
                  <th scope="col"><abbr title="Average damage per round">ADR</abbr></th>
                </tr>
              </thead>
              <tbody>
                {playerStats[teamIndex]!.map((player) => (
                  <tr key={player.nickname}>
                    <th scope="row">{player.nickname}</th>
                    <td>{player.kills}–{player.deaths}</td>
                    <td>{player.assists}</td>
                    <td>{player.adr.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ) : (
        <p className="reader-card__hltv-player-stats-pending" role="status">
          Waiting for player stats…
        </p>
      )}
    </details>
  );
}

function HltvMatchupTeam({
  team,
}: {
  team: NonNullable<OpenGraphPreview['matchTeams']>[number];
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

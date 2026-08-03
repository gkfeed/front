import type {
  HltvMatchSnapshot,
  HltvMatchTeamPreview,
  HltvRoundPreview,
} from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

import { HltvRoundHistory } from './HltvRoundHistory';

export function HltvPlayerStats({
  teams,
  playerStats,
  currentMap,
  teamSides,
  roundHistory,
  isFinal = false,
}: {
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview];
  playerStats: HltvMatchSnapshot['playerStats'];
  currentMap: HltvMatchSnapshot['currentMap'];
  teamSides: HltvMatchSnapshot['teamSides'];
  roundHistory: HltvRoundPreview[] | null | undefined;
  isFinal?: boolean;
}) {
  const { t } = useTranslation();
  const hasPlayerStats = playerStats?.some((team) => team.length > 0);
  const allPlayers = playerStats?.flat() ?? [];
  const bestAdrPlayer = allPlayers.reduce<typeof allPlayers[number] | null>(
    (best, player) => !best || player.adr > best.adr ? player : best,
    null,
  );
  const bestRatingPlayer = allPlayers.reduce<typeof allPlayers[number] | null>(
    (best, player) => player.rating !== undefined && (!best || (best.rating ?? -Infinity) < player.rating)
      ? player
      : best,
    null,
  );

  return (
    <details className="reader-card__hltv-player-stats" open={isFinal}>
      <summary>
        <span>{t('hltv.playerStats')}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <HltvRoundHistory
        teams={teams}
        teamSides={teamSides}
        roundHistory={roundHistory}
        roundCount={currentMap ? getRoundCount(currentMap.score) : null}
      />
      {hasPlayerStats && playerStats ? (
        <div className="reader-card__hltv-player-tables">
          {teams.map((team, teamIndex) => (
            <table key={team.name}>
              <caption>{team.name}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('hltv.player')}</th>
                  <th scope="col">K–D</th>
                  <th scope="col"><abbr title={t('hltv.averageDamage')}>ADR</abbr></th>
                  <th scope="col">{t('hltv.rating')}</th>
                </tr>
              </thead>
              <tbody>
                {playerStats[teamIndex]!.map((player) => (
                  <tr
                    key={player.nickname}
                    className={[
                      player === bestAdrPlayer ? 'reader-card__hltv-player-row--best-adr' : '',
                      player === bestRatingPlayer ? 'reader-card__hltv-player-row--best-rating' : '',
                    ].filter(Boolean).join(' ') || undefined}
                  >
                    <th scope="row">{player.nickname}</th>
                    <td>{player.kills}–{player.deaths}</td>
                    <td>{player.adr.toFixed(1)}</td>
                    <td>{player.rating?.toFixed(2) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      ) : (
        <p className="reader-card__hltv-player-stats-pending" role="status">
          {t('hltv.waiting')}
        </p>
      )}
    </details>
  );
}

function getRoundCount(score: [string, string]): number | null {
  const count = Number(score[0]) + Number(score[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

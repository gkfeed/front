import type { OpenGraphPreview } from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

export function HltvPlayerStats({
  teams,
  playerStats,
}: {
  teams: NonNullable<OpenGraphPreview['matchTeams']>;
  playerStats: OpenGraphPreview['matchPlayerStats'];
}) {
  const { t } = useTranslation();
  const hasPlayerStats = playerStats?.some((team) => team.length > 0);

  return (
    <details className="reader-card__hltv-player-stats">
      <summary>
        <span>{t('hltv.playerStats')}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      {hasPlayerStats && playerStats ? (
        <div className="reader-card__hltv-player-tables">
          {teams.map((team, teamIndex) => (
            <table key={team.name}>
              <caption>{team.name}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('hltv.player')}</th>
                  <th scope="col">K–D</th>
                  <th scope="col"><abbr title={t('hltv.assists')}>A</abbr></th>
                  <th scope="col"><abbr title={t('hltv.averageDamage')}>ADR</abbr></th>
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
          {t('hltv.waiting')}
        </p>
      )}
    </details>
  );
}

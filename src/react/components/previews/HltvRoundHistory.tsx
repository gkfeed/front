import type {
  HltvMatchTeamPreview,
  HltvMatchTeamSidesPreview,
  HltvRoundOutcome,
  HltvRoundPreview,
} from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';
import { HltvRoundIcon } from './HltvRoundIcon';
import {
  buildHltvRoundHistoryModel,
  getHltvRoundSide,
} from './hltvRoundHistoryModel';

const OUTCOME_LABELS: Record<HltvRoundOutcome, string> = {
  ct_win: 'ctWin',
  t_win: 'tWin',
  bomb_defused: 'bombDefused',
  bomb_exploded: 'bombExploded',
  stopwatch: 'stopwatch',
  unknown: 'roundWin',
};

export function HltvRoundHistory({
  teams,
  teamSides,
  roundHistory,
  roundCount,
}: {
  teams: [HltvMatchTeamPreview, HltvMatchTeamPreview];
  teamSides: HltvMatchTeamSidesPreview | null;
  roundHistory: HltvRoundPreview[] | null | undefined;
  roundCount?: number | null;
}) {
  const { t } = useTranslation();
  const model = buildHltvRoundHistoryModel(roundHistory, roundCount);
  if (!model) return null;
  const { lastRound, roundNumbers, results, swapAfterRound } = model;

  return (
    <section className="reader-card__hltv-round-history" aria-label={t('hltv.roundHistory')}>
      {teams.map((team, teamIndex) => (
        <div className="reader-card__hltv-round-history-row" key={team.name}>
          <span className="reader-card__hltv-round-history-team" title={team.name}>
            {team.logo ? (
              <img src={team.logo} alt="" />
            ) : (
              <span aria-hidden="true">{team.name.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <div className="reader-card__hltv-round-history-slots">
            {roundNumbers.flatMap((roundNumber) => {
              const result = results.get(roundNumber);
              const won = result?.teamIndex === teamIndex;
              const winnerSide = won && teamSides
                ? getHltvRoundSide(teamIndex, roundNumber, teamSides, swapAfterRound, lastRound)
                : null;
              const winnerClass = won
                ? winnerSide
                  ? `reader-card__hltv-round-history-slot--${winnerSide}`
                  : `reader-card__hltv-round-history-slot--team-${teamIndex}`
                : '';
              const slot = (
                <span
                  className={[
                    'reader-card__hltv-round-history-slot',
                    winnerClass,
                  ].filter(Boolean).join(' ')}
                  key={roundNumber}
                  role={won ? 'img' : undefined}
                  aria-label={won && result
                    ? t(`hltv.${OUTCOME_LABELS[result.outcome]}`, { round: roundNumber })
                    : undefined}
                  title={won && result
                    ? t(`hltv.${OUTCOME_LABELS[result.outcome]}`, { round: roundNumber })
                    : undefined}
                >
                  {won && result ? <HltvRoundIcon outcome={result.outcome} /> : null}
                </span>
              );
              if (roundNumber !== swapAfterRound) return [slot];
              return [
                slot,
                <span
                  className={[
                    'reader-card__hltv-round-history-swap',
                    teamIndex === 0 ? 'reader-card__hltv-round-history-swap--label' : '',
                  ].filter(Boolean).join(' ')}
                  key={`swap-${roundNumber}`}
                  role={teamIndex === 0 ? 'img' : undefined}
                  aria-label={teamIndex === 0 ? t('hltv.sideSwap') : undefined}
                  title={teamIndex === 0 ? t('hltv.sideSwap') : undefined}
                  aria-hidden={teamIndex === 0 ? undefined : true}
                />,
              ];
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

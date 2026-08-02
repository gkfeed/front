import type {
  HltvMatchTeamPreview,
  HltvMatchTeamSidesPreview,
  HltvRoundOutcome,
  HltvRoundPreview,
} from '../../../../shared/previewContracts';
import { useTranslation } from 'react-i18next';

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
  const rounds = getRounds(roundHistory);
  if (rounds.length === 0) return null;

  const lastRound = roundCount ?? rounds.at(-1)!.round;
  const roundNumbers = Array.from({ length: lastRound }, (_, index) => index + 1);
  const results = new Map(rounds.map((round) => [round.round, round]));
  const swapAfterRound = getSwapAfterRound(rounds, lastRound);

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
                ? getRoundSide(teamIndex, roundNumber, teamSides, swapAfterRound, lastRound)
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

function getRoundSide(
  teamIndex: number,
  roundNumber: number,
  teamSides: HltvMatchTeamSidesPreview,
  swapAfterRound: number | null,
  lastRound: number,
): HltvMatchTeamSidesPreview[number] {
  const side = teamSides[teamIndex as 0 | 1];
  if (swapAfterRound === null) return side;

  const currentSideIsSecondHalf = lastRound > swapAfterRound;
  const roundSideIsSecondHalf = roundNumber > swapAfterRound;
  if (currentSideIsSecondHalf === roundSideIsSecondHalf) return side;
  return side === 'ct' ? 't' : 'ct';
}

function getSwapAfterRound(rounds: HltvRoundPreview[], lastRound: number): number | null {
  const secondHalf = rounds
    .filter((round) => round.half === 2)
    .sort((first, second) => first.round - second.round)[0];
  if (secondHalf) {
    const firstHalfRounds = rounds
      .filter((round) => round.half === 1)
      .map((round) => round.round);
    return firstHalfRounds.length > 0
      ? Math.max(...firstHalfRounds)
      : Math.max(1, secondHalf.round - 1);
  }
  return lastRound > 12 ? 12 : null;
}

function getRounds(roundHistory: HltvRoundPreview[] | null | undefined): HltvRoundPreview[] {
  const byRound = new Map<number, HltvRoundPreview>();
  for (const round of roundHistory ?? []) {
    if (!byRound.has(round.round)) byRound.set(round.round, round);
  }
  return [...byRound.values()].sort((first, second) => first.round - second.round);
}

function HltvRoundIcon({ outcome }: { outcome: HltvRoundOutcome }) {
  if (outcome === 'bomb_exploded') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="14" r="5.5" />
        <path d="M11 8.5V6m0 0 2-2m-2 2-2-2M16 10l2-1m-1 5h3M6 10 4 9m1 5H2" />
      </svg>
    );
  }
  if (outcome === 'bomb_defused') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="11" cy="14" r="5.5" />
        <path d="m8 14 2 2 5-6M11 8.5V6m0 0 2-2" />
      </svg>
    );
  }
  if (outcome === 'stopwatch') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="13" r="6.5" />
        <path d="M12 3v3M9 3h6m-3 10V9m0 4 3 2" />
      </svg>
    );
  }
  if (outcome === 'ct_win') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3 7 3v5c0 4.5-2.8 7.7-7 10-4.2-2.3-7-5.5-7-10V6l7-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  if (outcome === 't_win') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 9.5C7 6.5 9 5 12 5s5 1.5 5 4.5v5c0 2.8-2.2 4.5-5 4.5s-5-1.7-5-4.5v-5Z" />
        <path d="M9.5 12h.1m4.8 0h.1M9 16c1.8 1 4.2 1 6 0M12 5V3m-3 1 1 1m5-1-1 1" />
      </svg>
    );
  }
  return <span className="reader-card__hltv-round-history-dot" aria-hidden="true" />;
}

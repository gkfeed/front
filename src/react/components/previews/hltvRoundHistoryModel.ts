import type {
  HltvMatchTeamSidesPreview,
  HltvRoundPreview,
} from '../../../../shared/previewContracts';

export type HltvRoundHistoryModel = {
  lastRound: number;
  roundNumbers: number[];
  results: ReadonlyMap<number, HltvRoundPreview>;
  swapAfterRound: number | null;
};

export function buildHltvRoundHistoryModel(
  roundHistory: HltvRoundPreview[] | null | undefined,
  roundCount?: number | null,
): HltvRoundHistoryModel | null {
  const rounds = getRounds(roundHistory);
  if (rounds.length === 0) return null;

  const lastRound = roundCount ?? rounds.at(-1)!.round;
  return {
    lastRound,
    roundNumbers: Array.from({ length: lastRound }, (_, index) => index + 1),
    results: new Map(rounds.map((round) => [round.round, round])),
    swapAfterRound: getSwapAfterRound(rounds, lastRound),
  };
}

export function getHltvRoundSide(
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

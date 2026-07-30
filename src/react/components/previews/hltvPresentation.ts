import type { OpenGraphPreview } from '../../../../shared/previewContracts';

export function getHltvMapScoreClass(
  score: [string, string],
  teamIndex: 0 | 1,
  teamSides: OpenGraphPreview['matchTeamSides'],
): string | undefined {
  if (!isCompletedHltvMapScore(score)) {
    return teamSides
      ? `reader-card__hltv-current-map-score--${teamSides[teamIndex]}`
      : undefined;
  }
  const winnerIndex = Number(score[0]) > Number(score[1]) ? 0 : 1;
  return winnerIndex === teamIndex
    ? 'reader-card__hltv-current-map-score--winner'
    : 'reader-card__hltv-current-map-score--loser';
}

export function isCompletedHltvMapScore(score: [string, string]): boolean {
  const first = Number(score[0]);
  const second = Number(score[1]);
  return Number.isFinite(first)
    && Number.isFinite(second)
    && Math.max(first, second) >= 13
    && Math.abs(first - second) >= 2;
}

export function formatHltvCountdown(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1_000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor(totalSeconds % 86_400 / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
  return days > 0 ? `${days}d ${clock}` : clock;
}

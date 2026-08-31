import type { HltvRoundOutcome, HltvRoundPreview } from '../../shared/previewContracts.js';
import { parseAttributes } from './html.js';
import {
  getHltvMapSections,
  normalizeHltvMapName,
  parseHltvCurrentMap,
  parseHltvMapNameAndScore,
} from './hltvMatchParser.js';

/** Parses the icon-based round history used on HLTV map overview pages. */
export function parseHltvRoundHistory(html: string): HltvRoundPreview[] | null {
  const currentMap = parseHltvCurrentMap(html);
  const currentMapSection = currentMap
    ? getHltvMapSections(html).reverse().find((section) => {
      const map = parseHltvMapNameAndScore(section);
      return map && normalizeHltvMapName(map.name) === normalizeHltvMapName(currentMap.name);
    })
    : null;
  const source = currentMapSection ?? html;
  const icons = (source.match(/<img\b[^>]*>/gi) ?? [])
    .map(parseAttributes)
    .map((attributes) => attributes.src ?? '')
    .map((src) => src.match(/\/scoreboard\/([^/?#]+)\.svg/i)?.[1]?.toLowerCase() ?? null)
    .filter((icon): icon is string => icon !== null);
  if (icons.length < 2 || icons.length % 2 !== 0) return null;

  const rowLength = icons.length / 2;
  const firstTeam = icons.slice(0, rowLength);
  const secondTeam = icons.slice(rowLength);
  const rounds = firstTeam.flatMap((firstIcon, index) => {
    const secondIcon = secondTeam[index];
    const firstOutcome = parseHltvRoundOutcome(firstIcon);
    const secondOutcome = parseHltvRoundOutcome(secondIcon);
    if (!firstOutcome && !secondOutcome) return [];
    return [{
      round: index + 1,
      teamIndex: (firstOutcome ? 0 : 1) as 0 | 1,
      outcome: firstOutcome ?? secondOutcome ?? 'unknown',
    }];
  });
  const history = rounds.length > 0 ? rounds : null;
  return currentMap ? alignHltvRoundHistoryToScore(history, currentMap.score) : history;
}

/** Corrects a reversed team-row order when the source history disagrees with the live score. */
export function alignHltvRoundHistoryToScore(
  history: HltvRoundPreview[] | null,
  score: [string, string],
): HltvRoundPreview[] | null {
  if (!history || history.length === 0) return history;
  const expected = score.map(Number);
  const totalRounds = expected[0]! + expected[1]!;
  if (!expected.every(Number.isInteger) || totalRounds !== history.length) return history;

  const wins = [0, 0];
  history.forEach((round) => { wins[round.teamIndex] += 1; });
  if (wins[0] === expected[0] && wins[1] === expected[1]) return history;
  if (wins[0] === expected[1] && wins[1] === expected[0]) {
    return history.map((round) => ({
      ...round,
      teamIndex: round.teamIndex === 0 ? 1 : 0,
    }));
  }

  const remaining = [...expected];
  return history.map((round) => {
    const sourceTeam = round.teamIndex;
    const otherTeam = sourceTeam === 0 ? 1 : 0;
    const teamIndex = remaining[sourceTeam]! > 0
      ? sourceTeam
      : remaining[otherTeam]! > 0
        ? otherTeam
        : sourceTeam;
    remaining[teamIndex]! -= 1;
    return { ...round, teamIndex: teamIndex as 0 | 1 };
  });
}

function parseHltvRoundOutcome(value: string | undefined): HltvRoundOutcome | null {
  switch (value) {
    case 'ct_win': return 'ct_win';
    case 't_win': return 't_win';
    case 'bomb_defused': return 'bomb_defused';
    case 'bomb_exploded': return 'bomb_exploded';
    case 'stopwatch': return 'stopwatch';
    case 'emptyhistory': return null;
    default: return value ? 'unknown' : null;
  }
}

import type {
  HltvCurrentMapPreview,
  HltvMatchSnapshot,
  HltvRoundOutcome,
  HltvRoundPreview,
} from '../../shared/previewContracts.js';
import { decodeHtml, htmlText, parseAttributes, resolveHttpUrl } from './html.js';

export function parseHltvMatchStatus(html: string): HltvMatchSnapshot['status'] {
  const countdown = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bcountdown\b[^"]*"|'[^']*\bcountdown\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  switch (htmlText(countdown ?? '').toLowerCase()) {
    case 'live': return 'live';
    case 'match over': return 'over';
    case 'match postponed': return 'postponed';
    case 'match deleted': return 'deleted';
    default: return 'scheduled';
  }
}

export function parseHltvMatchScore(html: string): HltvMatchSnapshot['score'] {
  let firstTeamMaps = 0;
  let secondTeamMaps = 0;

  getHltvMapSections(html).forEach((map) => {
    if (!hasHltvCompletedMap(map)) return;
    if (hasHltvResultClass(map, 'results-left', 'won')) firstTeamMaps += 1;
    if (hasHltvResultClass(map, 'results-right', 'won')) secondTeamMaps += 1;
  });

  return [String(firstTeamMaps), String(secondTeamMaps)];
}

export function parseHltvCurrentMap(html: string): HltvMatchSnapshot['currentMap'] {
  const maps = getHltvMapSections(html).map((map) => {
    if (hasHltvCompletedMap(map)) return null;
    const nameMarkup = map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const scores = [...map.matchAll(
      /<div\b[^>]*class=(?:"[^"]*\bresults-team-score\b[^"]*"|'[^']*\bresults-team-score\b[^']*')[^>]*>([\s\S]*?)<\/div>/gi,
    )].map((match) => htmlText(match[1] ?? ''));
    const name = htmlText(nameMarkup ?? '');
    if (!name || scores.length < 2 || !scores.slice(0, 2).every((score) => /^\d+$/.test(score))) return null;
    return { name, score: [scores[0]!, scores[1]!] as [string, string] };
  });

  for (let index = maps.length - 1; index >= 0; index -= 1) {
    const map = maps[index];
    if (map) return map;
  }
  return null;
}

export function parseHltvCompletedMaps(html: string): NonNullable<HltvMatchSnapshot['completedMaps']> {
  return getHltvMapSections(html).flatMap((map) => {
    const parsed = parseHltvMapNameAndScore(map);
    if (!parsed || (!hasHltvCompletedMap(map) && !isCompletedHltvMapScore(parsed.score))) return [];
    return [parsed];
  });
}

/** Parses the icon-based round history used on HLTV map overview pages. */
export function parseHltvRoundHistory(html: string): HltvRoundPreview[] | null {
  const currentMap = parseHltvCurrentMap(html);
  const currentMapSection = currentMap
    ? getHltvMapSections(html)
      .reverse()
      .find((section) => {
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

  // The live payload can contain the right number of round entries but lose
  // the team association. Keep the round order and outcomes, while using the
  // authoritative map score to prevent an impossible winner distribution.
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

export function parseHltvMatchStartsAt(html: string): string | null {
  const sectionMatch = /<div\b[^>]*class=(?:"[^"]*\btimeAndEvent\b[^"]*"|'[^']*\btimeAndEvent\b[^']*')[^>]*>/i.exec(html);
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const section = html.slice(sectionMatch.index, sectionMatch.index + 2_000);
  const unixValue = section.match(/\bdata-unix=(?:"(\d{10,13})"|'(\d{10,13})')/i);
  const rawTimestamp = unixValue?.[1] ?? unixValue?.[2];
  if (!rawTimestamp) return null;

  const timestamp = Number(rawTimestamp) * (rawTimestamp.length === 10 ? 1_000 : 1);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

export function parseHltvMatchTeams(
  html: string,
  pageUrl: URL,
): HltvMatchSnapshot['teams'] {
  const teams = [1, 2].map((side) => {
    const blockPattern = new RegExp(
      `<div\\b[^>]*class=(?:"[^"]*\\bteam${side}-gradient\\b[^"]*"|'[^']*\\bteam${side}-gradient\\b[^']*')[^>]*>`,
      'i',
    );
    const block = blockPattern.exec(html);
    if (!block || block.index === undefined) return null;

    const section = html.slice(block.index, block.index + 4_000);
    const nameMarkup = section.match(
      /<div\b[^>]*class=(?:"[^"]*\bteamName\b[^"]*"|'[^']*\bteamName\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const name = htmlText(nameMarkup ?? '');
    if (!name) return null;

    const logoTags = section.match(/<img\b[^>]*>/gi) ?? [];
    const preferredLogo = logoTags.map(parseAttributes).find((attributes) => {
      const classes = attributes.class?.split(/\s+/) ?? [];
      return classes.includes('logo') && !classes.includes('night-only') && attributes.src;
    });

    return {
      name,
      logo: resolveHttpUrl(decodeHtml(preferredLogo?.src ?? ''), pageUrl),
    };
  });

  return teams[0] && teams[1] ? [teams[0], teams[1]] : null;
}

/** Resolves the display name used by an HLTV page for a Scorebot map slug. */
export function findHltvMapDisplayName(html: string, mapName: string): string {
  const mapSlug = normalizeHltvMapName(mapName);
  return getHltvMapSections(html)
    .map((map) => htmlText(map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? ''))
    .find((name) => normalizeHltvMapName(name) === mapSlug)
    ?? prettifyHltvMapName(mapName);
}

function parseHltvMapNameAndScore(html: string): HltvCurrentMapPreview | null {
  const nameMarkup = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  const scores = [...html.matchAll(
    /<div\b[^>]*class=(?:"[^"]*\bresults-team-score\b[^"]*"|'[^']*\bresults-team-score\b[^']*')[^>]*>([\s\S]*?)<\/div>/gi,
  )].map((match) => htmlText(match[1] ?? ''));
  const name = htmlText(nameMarkup ?? '');
  if (!name || scores.length < 2 || !scores.slice(0, 2).every((score) => /^\d+$/.test(score))) return null;
  return { name, score: [scores[0]!, scores[1]!] };
}

function isCompletedHltvMapScore(score: [string, string]): boolean {
  const first = Number(score[0]);
  const second = Number(score[1]);
  return Math.max(first, second) >= 13 && Math.abs(first - second) >= 2;
}

function getHltvMapSections(html: string): string[] {
  const mapStarts = [...html.matchAll(
    /<div\b[^>]*class=(?:"[^"]*\bmapholder\b[^"]*"|'[^']*\bmapholder\b[^']*')[^>]*>/gi,
  )];
  return mapStarts.map((match, index) => {
    const start = match.index ?? 0;
    const end = mapStarts[index + 1]?.index ?? Math.min(html.length, start + 20_000);
    return html.slice(start, end);
  });
}

function hasHltvCompletedMap(html: string): boolean {
  const links = html.match(/<a\b[^>]*>/gi) ?? [];
  return links.some((tag) => {
    const attributes = parseAttributes(tag);
    return Boolean(attributes.href && attributes.class?.split(/\s+/).includes('results-stats'));
  });
}

function hasHltvResultClass(html: string, sideClass: string, resultClass: string): boolean {
  const openingTags = html.match(/<(?:div|span)\b[^>]*class=(?:"[^"]*"|'[^']*')[^>]*>/gi) ?? [];
  return openingTags.some((tag) => {
    const classes = parseAttributes(tag).class?.split(/\s+/) ?? [];
    return classes.includes(sideClass) && classes.includes(resultClass);
  });
}

function normalizeHltvMapName(mapName: string): string {
  return mapName.replace(/^de_/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function prettifyHltvMapName(mapName: string): string {
  const withoutPrefix = mapName.replace(/^de_/, '');
  return withoutPrefix.replace(/^./, (letter) => letter.toUpperCase());
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

import type {
  HltvCurrentMapPreview,
  HltvMatchSnapshot,
  HltvMatchPlayerStatsPreview,
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

/** Parses the aggregate player tables shown for a completed match. */
export function parseHltvPlayerStats(html: string): HltvMatchPlayerStatsPreview | null {
  const tables = getHltvTotalStatsTables(html);
  if (tables.length < 2) return null;

  const playerStats: HltvMatchPlayerStatsPreview = [
    parseHltvPlayerStatsTable(tables[0]!),
    parseHltvPlayerStatsTable(tables[1]!),
  ];
  return playerStats.some((team) => team.length > 0) ? playerStats : null;
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

export function parseHltvMatchTournament(html: string): string | null {
  const sectionMatch = /<div\b[^>]*class=(?:"[^"]*\btimeAndEvent\b[^"]*"|'[^']*\btimeAndEvent\b[^']*')[^>]*>/i.exec(html);
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const section = html.slice(sectionMatch.index, sectionMatch.index + 4_000);
  for (const anchor of section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const openingTag = anchor[0].match(/^<a\b[^>]*>/i)?.[0];
    const href = openingTag ? parseAttributes(openingTag).href : null;
    if (!href || !/(?:^|\/)events\/\d+(?:\/|$)/i.test(href)) continue;
    const tournament = htmlText(anchor[1] ?? '');
    if (tournament) return tournament;
  }
  return null;
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

function getHltvTotalStatsTables(html: string): string[] {
  return [...html.matchAll(/<table\b[^>]*>/gi)].flatMap((match) => {
    const openingTag = match[0] ?? '';
    const classes = parseAttributes(openingTag).class?.split(/\s+/) ?? [];
    if (!classes.includes('totalstats')) return [];

    const start = match.index ?? 0;
    const closingTag = html.indexOf('</table>', start + openingTag.length);
    return closingTag === -1 ? [] : [html.slice(start, closingTag + '</table>'.length)];
  });
}

function parseHltvPlayerStatsTable(
  table: string,
): NonNullable<HltvMatchSnapshot['playerStats']>[number] {
  return [...table.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].flatMap((match) => {
    const row = match[0] ?? '';
    const playerCell = getHltvStatsCell(row, 'players', 'st-player');
    const nickname = parseHltvPlayerNickname(playerCell);
    const kdCell = getHltvStatsCell(row, 'kd');
    const kills = parseFirstHltvStatsNumber(getHltvStatsCell(row, 'st-kills'))
      ?? parseHltvKillDeath(kdCell)?.[0]
      ?? null;
    const deaths = parseFirstHltvStatsNumber(getHltvStatsCell(row, 'st-deaths'))
      ?? parseHltvKillDeath(kdCell)?.[1]
      ?? null;
    const assists = parseFirstHltvStatsNumber(getHltvStatsCell(row, 'st-assists'));
    const adr = parseFirstHltvStatsNumber(getHltvStatsCell(row, 'adr', 'st-adr'));
    const rating = parseFirstHltvStatsNumber(getHltvStatsCell(row, 'rating', 'st-rating'));
    if (!nickname || kills === null || deaths === null || adr === null || rating === null) return [];

    return [{
      nickname,
      kills,
      deaths,
      adr,
      rating,
      ...(assists === null ? {} : { assists }),
    }];
  });
}

function parseHltvPlayerNickname(playerCell: string): string {
  const nicknameMarkup = playerCell.match(
    /<[^>]+class=(?:"[^"]*\bplayer-nick\b[^"]*"|'[^']*\bplayer-nick\b[^']*')[^>]*>([\s\S]*?)<\/[^>]+>/i,
  )?.[1];
  if (nicknameMarkup) return htmlText(nicknameMarkup);

  const anchorMarkup = playerCell.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
  return htmlText(anchorMarkup ?? '');
}

function parseHltvKillDeath(value: string): [number, number] | null {
  const numbers = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 2).map(Number) ?? [];
  return numbers.length === 2 && numbers.every(Number.isFinite)
    ? [numbers[0]!, numbers[1]!]
    : null;
}

function getHltvStatsCell(row: string, ...classNames: string[]): string {
  for (const match of row.matchAll(/<(td|th)\b[^>]*>/gi)) {
    const openingTag = match[0] ?? '';
    const classes = parseAttributes(openingTag).class?.split(/\s+/) ?? [];
    if (!classNames.some((className) => classes.includes(className))) continue;

    const start = match.index ?? 0;
    const closingTag = `</${match[1]}>`;
    const end = row.indexOf(closingTag, start + openingTag.length);
    return end === -1 ? row.slice(start) : row.slice(start, end + closingTag.length);
  }
  return '';
}

function parseFirstHltvStatsNumber(value: string): number | null {
  const number = value.match(/-?\d+(?:\.\d+)?/)?.[0];
  if (!number) return null;
  const parsed = Number(number);
  return Number.isFinite(parsed) ? parsed : null;
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

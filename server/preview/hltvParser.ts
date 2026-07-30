import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
  HltvPlayerStatsPreview,
  OpenGraphPreview,
} from '../../shared/previewContracts.js';
import { decodeHtml, htmlText, parseAttributes, resolveHttpUrl } from './html.js';

export interface HltvScorebotSnapshot {
  currentMap: HltvCurrentMapPreview;
  playerStats: HltvMatchPlayerStatsPreview;
  teamSides: HltvMatchTeamSidesPreview;
}

export function parseHltvMatchStatus(html: string): OpenGraphPreview['matchStatus'] {
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

export function parseHltvMatchScore(html: string): OpenGraphPreview['matchScore'] {
  let firstTeamMaps = 0;
  let secondTeamMaps = 0;

  getHltvMapSections(html).forEach((map) => {
    if (!hasHltvCompletedMap(map)) return;
    if (hasHltvResultClass(map, 'results-left', 'won')) firstTeamMaps += 1;
    if (hasHltvResultClass(map, 'results-right', 'won')) secondTeamMaps += 1;
  });

  return [String(firstTeamMaps), String(secondTeamMaps)];
}

export function parseHltvCurrentMap(html: string): OpenGraphPreview['matchCurrentMap'] {
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

export function parseHltvCompletedMaps(html: string): NonNullable<OpenGraphPreview['matchCompletedMaps']> {
  return getHltvMapSections(html).flatMap((map) => {
    const parsed = parseHltvMapNameAndScore(map);
    if (!parsed || (!hasHltvCompletedMap(map) && !isCompletedHltvMapScore(parsed.score))) return [];
    return [parsed];
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
): OpenGraphPreview['matchTeams'] {
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

export function parseHltvScoreboardUpdate(
  value: unknown,
  html: string,
  team1Id: string,
): HltvCurrentMapPreview | null {
  return parseHltvScoreboardSnapshot(value, html, team1Id)?.currentMap ?? null;
}

export function parseHltvScoreboardSnapshot(
  value: unknown,
  html: string,
  team1Id: string,
): HltvScorebotSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const scoreboard = value as Record<string, unknown>;
  const mapName = typeof scoreboard.mapName === 'string' ? scoreboard.mapName : '';
  const ctTeamId = Number(scoreboard.ctTeamId);
  const terroristTeamId = Number(scoreboard.tTeamId);
  const ctScore = Number(scoreboard.ctTeamScore ?? scoreboard.counterTerroristScore);
  const terroristScore = Number(scoreboard.tTeamScore ?? scoreboard.terroristScore);
  const firstTeamId = Number(team1Id);
  if (
    !mapName
    || ![ctTeamId, terroristTeamId, ctScore, terroristScore, firstTeamId].every(Number.isFinite)
    || ![ctTeamId, terroristTeamId].includes(firstTeamId)
  ) return null;

  const mapSlug = mapName.replace(/^de_/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const displayName = getHltvMapSections(html)
    .map((map) => htmlText(map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? ''))
    .find((name) => name.replace(/[^a-z0-9]/gi, '').toLowerCase() === mapSlug)
    ?? mapName.replace(/^de_/, '').replace(/^./, (letter) => letter.toUpperCase());
  const score: [string, string] = firstTeamId === ctTeamId
    ? [String(ctScore), String(terroristScore)]
    : [String(terroristScore), String(ctScore)];

  const ctPlayers = parseHltvScoreboardPlayers(scoreboard.CT);
  const terroristPlayers = parseHltvScoreboardPlayers(scoreboard.TERRORIST);
  const playerStats: HltvMatchPlayerStatsPreview = firstTeamId === ctTeamId
    ? [ctPlayers, terroristPlayers]
    : [terroristPlayers, ctPlayers];

  return {
    currentMap: { name: displayName, score },
    playerStats,
    teamSides: firstTeamId === ctTeamId ? ['ct', 't'] : ['t', 'ct'],
  };
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

function parseHltvScoreboardPlayers(value: unknown): HltvPlayerStatsPreview[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const player = entry as Record<string, unknown>;
    const nickname = typeof player.nick === 'string' && player.nick.trim()
      ? player.nick.trim()
      : typeof player.name === 'string' ? player.name.trim() : '';
    const kills = Number(player.score);
    const deaths = Number(player.deaths);
    const assists = Number(player.assists);
    const adr = Number(player.damagePrRound);
    if (!nickname || ![kills, deaths, assists, adr].every(Number.isFinite)) return [];
    return [{ nickname, kills, deaths, assists, adr: Math.round(adr * 10) / 10 }];
  });
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

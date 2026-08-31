import type { HltvMatchPlayerStatsPreview, HltvMatchSnapshot } from '../../shared/previewContracts.js';
import { htmlText, parseAttributes } from './html.js';

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
    return [{ nickname, kills, deaths, adr, rating, ...(assists === null ? {} : { assists }) }];
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

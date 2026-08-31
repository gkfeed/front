import type { HltvCurrentMapPreview, HltvMatchSnapshot } from '../../shared/previewContracts.js';
import { htmlText, parseAttributes } from './html.js';

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
  const maps = getHltvMapSections(html).map((map) => (
    hasHltvCompletedMap(map) ? null : parseHltvMapNameAndScore(map)
  ));
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

export function findHltvMapDisplayName(html: string, mapName: string): string {
  const mapSlug = normalizeHltvMapName(mapName);
  return getHltvMapSections(html)
    .map((map) => htmlText(map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? ''))
    .find((name) => normalizeHltvMapName(name) === mapSlug)
    ?? prettifyHltvMapName(mapName);
}

export function parseHltvMapNameAndScore(html: string): HltvCurrentMapPreview | null {
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

export function getHltvMapSections(html: string): string[] {
  const mapStarts = [...html.matchAll(
    /<div\b[^>]*class=(?:"[^"]*\bmapholder\b[^"]*"|'[^']*\bmapholder\b[^']*')[^>]*>/gi,
  )];
  return mapStarts.map((match, index) => {
    const start = match.index ?? 0;
    const end = mapStarts[index + 1]?.index ?? Math.min(html.length, start + 20_000);
    return html.slice(start, end);
  });
}

export function normalizeHltvMapName(mapName: string): string {
  return mapName.replace(/^de_/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function isCompletedHltvMapScore(score: [string, string]): boolean {
  const first = Number(score[0]);
  const second = Number(score[1]);
  return Math.max(first, second) >= 13 && Math.abs(first - second) >= 2;
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

function prettifyHltvMapName(mapName: string): string {
  const withoutPrefix = mapName.replace(/^de_/, '');
  return withoutPrefix.replace(/^./, (letter) => letter.toUpperCase());
}

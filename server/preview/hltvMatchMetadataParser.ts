import type { HltvMatchSnapshot } from '../../shared/previewContracts.js';
import { htmlText, parseAttributes } from './html.js';

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

export function parseHltvMatchStartsAt(html: string): string | null {
  const section = getHltvTimeAndEventSection(html, 2_000);
  if (!section) return null;
  const unixValue = section.match(/\bdata-unix=(?:"(\d{10,13})"|'(\d{10,13})')/i);
  const rawTimestamp = unixValue?.[1] ?? unixValue?.[2];
  if (!rawTimestamp) return null;
  const timestamp = Number(rawTimestamp) * (rawTimestamp.length === 10 ? 1_000 : 1);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseHltvMatchTournament(html: string): string | null {
  const section = getHltvTimeAndEventSection(html, 4_000);
  if (!section) return null;
  for (const anchor of section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const openingTag = anchor[0].match(/^<a\b[^>]*>/i)?.[0];
    const href = openingTag ? parseAttributes(openingTag).href : null;
    if (!href || !/(?:^|\/)events\/\d+(?:\/|$)/i.test(href)) continue;
    const tournament = htmlText(anchor[1] ?? '');
    if (tournament) return tournament;
  }
  return null;
}

function getHltvTimeAndEventSection(html: string, maxLength: number): string | null {
  const sectionMatch = /<div\b[^>]*class=(?:"[^"]*\btimeAndEvent\b[^"]*"|'[^']*\btimeAndEvent\b[^']*')[^>]*>/i.exec(html);
  if (!sectionMatch || sectionMatch.index === undefined) return null;
  return html.slice(sectionMatch.index, sectionMatch.index + maxLength);
}

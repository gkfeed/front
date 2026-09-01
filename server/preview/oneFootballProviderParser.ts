import type {
  OneFootballMatchTeamPreview,
  OneFootballProviderData,
} from '../../shared/previewContracts.js';
import { decodeHtml, htmlText, parseAttributes, resolveHttpUrl } from './html.js';

type SportsTeam = { name?: unknown; logo?: unknown };
type SportsEvent = {
  '@type'?: unknown;
  homeTeam?: unknown;
  awayTeam?: unknown;
  startDate?: unknown;
};

export function parseOneFootballProviderData(
  html: string,
  pageUrl: URL,
): OneFootballProviderData | null {
  const event = findSportsEvent(html);
  const homeTeam = parseTeam(event?.homeTeam, pageUrl);
  const awayTeam = parseTeam(event?.awayTeam, pageUrl);
  if (!homeTeam || !awayTeam) return null;

  const scoreMarkup = html.match(
    /<p\b[^>]*class=(?:"[^"]*MatchScore_scores__[^"]*"|'[^']*MatchScore_scores__[^']*')[^>]*>([\s\S]*?)<\/p>/i,
  )?.[1];
  const scoreParts = scoreMarkup
    ? [...scoreMarkup.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((part) => htmlText(part[1] ?? ''))
      .filter((part) => /^\d+$/.test(part))
    : [];
  const score: [string, string] | null = scoreParts.length >= 2
    ? [scoreParts[0]!, scoreParts[1]!]
    : null;
  const scoreEnd = scoreMarkup ? html.indexOf(scoreMarkup) + scoreMarkup.length : -1;
  const status = scoreEnd >= 0
    ? htmlText(html.slice(scoreEnd, scoreEnd + 500).match(
      /<span\b[^>]*class=(?:"[^"]*title-8-medium[^"]*"|'[^']*title-8-medium[^']*')[^>]*>([\s\S]*?)<\/span>/i,
    )?.[1] ?? '') || null
    : null;
  const competition = htmlText(html.match(
    /<span\b[^>]*class=(?:"[^"]*MatchScoreCompetition_competitionName__[^"]*"|'[^']*MatchScoreCompetition_competitionName__[^']*')[^>]*>([\s\S]*?)<\/span>/i,
  )?.[1] ?? '') || null;

  return {
    provider: 'onefootball',
    snapshot: {
      competition,
      teams: [homeTeam, awayTeam],
      score,
      status,
      startsAt: typeof event?.startDate === 'string' ? event.startDate : null,
    },
  };
}

function findSportsEvent(html: string): SportsEvent | null {
  for (const script of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const openingTag = script.match(/^<script\b[^>]*>/i)?.[0];
    if (!openingTag || parseAttributes(openingTag).type?.toLowerCase() !== 'application/ld+json') continue;
    const json = script.slice(openingTag.length, -'</script>'.length).trim();
    try {
      const value: unknown = JSON.parse(decodeHtml(json));
      const values = Array.isArray(value) ? value : [value];
      const event = values.find((entry): entry is SportsEvent => (
        Boolean(entry) && typeof entry === 'object' && (entry as SportsEvent)['@type'] === 'SportsEvent'
      ));
      if (event) return event;
    } catch {
      // Ignore unrelated or malformed structured-data blocks.
    }
  }
  return null;
}

function parseTeam(value: unknown, pageUrl: URL): OneFootballMatchTeamPreview | null {
  if (!value || typeof value !== 'object') return null;
  const team = value as SportsTeam;
  if (typeof team.name !== 'string' || !team.name.trim()) return null;
  return {
    name: team.name.trim(),
    logo: typeof team.logo === 'string' ? resolveHttpUrl(team.logo, pageUrl) : null,
  };
}

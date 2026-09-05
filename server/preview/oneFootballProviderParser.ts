import type {
  OneFootballMatchTeamPreview,
  OneFootballProviderData,
} from '../../shared/previewContracts.js';
import { isRecord } from '../../shared/valueGuards.js';
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

  const summary = findMatchScore(html, homeTeam.name, awayTeam.name);
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
      score: summary ? parseScore(summary.homeTeam, summary.awayTeam) : score,
      status: summary && typeof summary.timePeriod === 'string' ? summary.timePeriod || null : status,
      normalizedStatus: normalizePeriod(summary?.period),
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

// Numeric enum observed in OneFootball's browser bundle. See fixtures/onefootball/README.md.
function normalizePeriod(period: unknown): 'scheduled' | 'live' | 'over' | 'postponed' | null {
  switch (period) {
    case 1: return 'scheduled';
    case 3: return 'postponed';
    case 4: case 5: case 7: case 8: case 9: case 10: return 'live';
    case 11: case 12: case 13: return 'over';
    default: return null;
  }
}

function parseScore(home: unknown, away: unknown): [string, string] | null {
  if (!isRecord(home) || !isRecord(away)) return null;
  return typeof home.score === 'string' && /^\d+$/.test(home.score)
    && typeof away.score === 'string' && /^\d+$/.test(away.score)
    ? [home.score, away.score] : null;
}

function findMatchScore(html: string, homeName: string, awayName: string): Record<string, unknown> | null {
  for (const script of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? []) {
    const opening = script.match(/^<script\b[^>]*>/i)?.[0];
    if (!opening || parseAttributes(opening).id !== '__NEXT_DATA__') continue;
    try {
      const data: unknown = JSON.parse(script.slice(opening.length, -'</script>'.length));
      if (!isRecord(data) || !isRecord(data.props) || !isRecord(data.props.pageProps)) return null;
      const containers = data.props.pageProps.containers;
      if (!Array.isArray(containers)) return null;
      const summaries: Record<string, unknown>[] = [];
      for (const container of containers) {
        if (!isRecord(container) || !isRecord(container.type) || !isRecord(container.type.fullWidth)) continue;
        const component = container.type.fullWidth.component;
        if (!isRecord(component) || !isRecord(component.contentType)) continue;
        const content = component.contentType;
        if (content.$case !== 'matchScore' || !isRecord(content.matchScore)) continue;
        summaries.push(content.matchScore);
      }
      // Never pick a live recommendation or resolve ambiguous match summaries.
      if (summaries.length !== 1) return null;
      const summary = summaries[0]!;
      return isRecord(summary.homeTeam) && summary.homeTeam.name === homeName
        && isRecord(summary.awayTeam) && summary.awayTeam.name === awayName ? summary : null;
    } catch {
      return null;
    }
  }
  return null;
}

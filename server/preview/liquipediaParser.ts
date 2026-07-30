import type { LiquipediaMatchPreview } from '../../shared/previewContracts.js';
import { decodeHtml, htmlText, resolveHttpUrl } from './html.js';

export function parseLiquipediaMatch(
  html: string,
  pageUrl: URL,
): LiquipediaMatchPreview | null {
  const headerStart = html.indexOf('<div class="match-bm">');
  if (headerStart < 0) return null;

  const headerEnd = html.indexOf('<div class="toggle-area', headerStart);
  const header = html.slice(headerStart, headerEnd < 0 ? undefined : headerEnd);
  const dateMarkup = header.match(/match-bm-match-header-date"[^>]*>([\s\S]*?)<div class="match-bm-match-header-overview"/i)?.[1];
  const resultMatch = header.match(/match-bm-match-header-result"[^>]*>\s*([^<]+)<div class="match-bm-match-header-result-text"[^>]*>([\s\S]*?)<\/div>/i);
  const tournamentMarkup = header.match(/match-bm-match-header-tournament"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const teamNamePattern = /match-bm-match-header-team-long"[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const teamNameMatches = [...header.matchAll(teamNamePattern)].slice(0, 2);

  if (!dateMarkup || !resultMatch || !tournamentMarkup || teamNameMatches.length !== 2) return null;

  const teams = teamNameMatches.map((match, index) => {
    const matchIndex = match.index ?? 0;
    const nextIndex = teamNameMatches[index + 1]?.index ?? header.length;
    const opponentStart = header.lastIndexOf('match-bm-match-header-opponent ', matchIndex);
    const segment = header.slice(Math.max(opponentStart, 0), nextIndex);
    const name = htmlText(match[1] ?? '');
    const shortNameMarkup = segment.match(/match-bm-match-header-team-short"[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const imageSources = [...segment.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
      .map((image) => image[1] ?? image[2] ?? '');
    const preferredImage = imageSources.find((source) => /darkmode/i.test(source)) ?? imageSources[0];
    const results = [...segment.matchAll(/data-label-type=(?:"result-(win|loss|default)"|'result-(win|loss|default)')/gi)]
      .map((label) => (label[1] ?? label[2])!.toLowerCase() as 'win' | 'loss' | 'default');

    return {
      name,
      shortName: htmlText(shortNameMarkup ?? name),
      logo: preferredImage ? resolveHttpUrl(decodeHtml(preferredImage), pageUrl) : null,
      results,
    };
  });
  const score = htmlText(resultMatch[1] ?? '').split(':').map((part) => part.trim());
  if (score.length !== 2 || teams.some((team) => !team.name)) return null;

  return {
    date: htmlText(dateMarkup),
    status: htmlText(resultMatch[2] ?? ''),
    score: [score[0]!, score[1]!],
    teams: [teams[0]!, teams[1]!],
    tournament: htmlText(tournamentMarkup),
  };
}

import { parseHTML } from 'linkedom';

import type { LiquipediaMatchPreview } from '../../shared/previewContracts.js';
import { resolveHttpUrl } from './html.js';

export function parseLiquipediaMatch(
  html: string,
  pageUrl: URL,
): LiquipediaMatchPreview | null {
  const { document } = parseHTML(html);
  const header = document.querySelector('.match-bm > .match-bm-match-header');
  const overview = header?.querySelector('.match-bm-match-header-overview');
  const date = text(header?.querySelector('.match-bm-match-header-date'));
  const result = overview?.querySelector('.match-bm-match-header-result');
  const status = text(result?.querySelector('.match-bm-match-header-result-text'));
  const tournament = text(header?.querySelector('.match-bm-match-header-tournament'));
  const teamElements = overview
    ? Array.from(overview.querySelectorAll('.match-bm-match-header-opponent')).slice(0, 2)
    : [];

  if (!date || !result || !status || !tournament || teamElements.length !== 2) return null;

  const score = Array.from(result.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? '')
    .join('')
    .split(':')
    .map((part) => part.replace(/\s+/g, ' ').trim());
  const teams = teamElements.map((team) => {
    const name = text(team.querySelector('.match-bm-match-header-team-long'));
    const shortName = text(team.querySelector('.match-bm-match-header-team-short')) || name;
    const images = Array.from(team.querySelectorAll('img'));
    const preferredImage = team.querySelector('.team-template-darkmode img')
      ?? images.find((image) => /darkmode/i.test(image.getAttribute('src') ?? ''))
      ?? images[0];
    const results = Array.from(team.querySelectorAll('[data-label-type]'))
      .map((label) => label.getAttribute('data-label-type')?.match(/^result-(win|loss|default)$/i)?.[1])
      .filter((value): value is 'win' | 'loss' | 'default' => Boolean(value))
      .map((value) => value.toLowerCase() as 'win' | 'loss' | 'default');

    return {
      name,
      shortName,
      logo: resolveHttpUrl(preferredImage?.getAttribute('src'), pageUrl),
      results,
    };
  });
  if (score.length !== 2 || teams.some((team) => !team.name)) return null;

  return {
    date,
    status,
    score: [score[0]!, score[1]!],
    teams: [teams[0]!, teams[1]!],
    tournament,
  };
}

function text(element: Element | null | undefined): string {
  return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

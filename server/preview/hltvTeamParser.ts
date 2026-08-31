import type { HltvMatchSnapshot } from '../../shared/previewContracts.js';
import { decodeHtml, htmlText, parseAttributes, resolveHttpUrl } from './html.js';

export function parseHltvMatchTeams(html: string, pageUrl: URL): HltvMatchSnapshot['teams'] {
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
    return { name, logo: resolveHttpUrl(decodeHtml(preferredLogo?.src ?? ''), pageUrl) };
  });
  return teams[0] && teams[1] ? [teams[0], teams[1]] : null;
}

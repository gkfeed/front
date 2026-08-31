import { parseAttributes } from './html.js';

export type HltvScorebotEndpoint = {
  scorebotId: string;
  team1Id: string;
  url: URL;
};

export function parseHltvScorebotEndpoint(html: string): HltvScorebotEndpoint | null {
  const scoreboardTag = html.match(
    /<div\b[^>]*\bid=(?:"scoreboardElement"|'scoreboardElement')[^>]*>/i,
  )?.[0];
  if (!scoreboardTag) return null;

  const attributes = parseAttributes(scoreboardTag);
  const scorebotId = attributes['data-scorebot-id'];
  const team1Id = attributes['data-team1-id'];
  const rawUrl = attributes['data-scorebot-url']?.split(',').at(-1)?.trim();
  if (!scorebotId || !team1Id || !rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    return isValidHltvScorebotUrl(url) ? { scorebotId, team1Id, url } : null;
  } catch {
    return null;
  }
}

function isValidHltvScorebotUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.hash
    && hostname.endsWith('.hltv.org');
}

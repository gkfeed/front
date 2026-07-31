import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import { PreviewError } from './errors.js';
import { fetchLiquipediaMatch } from './liquipedia.js';
import { fetchRedditPreviewImage } from './reddit.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchHltvHtml } from './hltvFetcher.js';
import { parseLiquipediaMatch } from './liquipediaParser.js';
import type { HltvPage } from './hltvFetcher.js';
import { isHltvMatchUrl, parseOpenGraph } from './openGraphParser.js';

export { parseLiquipediaMatch };
export { fetchLiquipediaMatch };
export { fetchRedditPreviewImage };
export { PreviewError };
export {
  parseHltvScoreboardSnapshot,
  parseHltvScoreboardUpdate,
} from './hltvScorebotParser.js';
export { parseOpenGraph } from './openGraphParser.js';

const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';

export async function fetchOpenGraph(input: string): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  const url = getPreviewUrl(requestedUrl);
  if (isHltvMatchUrl(url)) {
    const page = await fetchHltvHtml(url);
    return enrichHltvPreview(parseOpenGraph(page.html, page.url), page);
  }

  const page = await fetchHtml(
    url,
    isRezkaUrl(requestedUrl) ? REZKA_USER_AGENT : TWITTERBOT_USER_AGENT,
    { metadataOnly: isMatreshkaVideoUrl(requestedUrl) },
  );
  return parseOpenGraph(page.html, page.url);
}

function enrichHltvPreview(preview: OpenGraphPreview, page: HltvPage): OpenGraphPreview {
  if (page.currentMap) preview.matchCurrentMap = page.currentMap;
  if (page.playerStats) preview.matchPlayerStats = page.playerStats;
  if (page.teamSides) preview.matchTeamSides = page.teamSides;
  return preview;
}

function getPreviewUrl(url: URL): URL {
  if (!isRezkaUrl(url)) return url;
  const previewUrl = new URL(url.href);
  previewUrl.host = 'rezka.ag';
  return previewUrl;
}

function isRezkaUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'hdrezka.me';
}

function isMatreshkaVideoUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'matreshka.tv'
    && /^\/video\/[^/]+(?:\/|$)/i.test(url.pathname);
}

import { parseHTML } from 'linkedom';
import { isLiveballMatchUrl } from '../../../shared/urlRules.js';
import type { LiveballProviderData } from '../../../shared/providerData/liveball.js';
import type { OpenGraphProviderAdapter } from '../openGraphProviderAdapter.js';
import { fetchHtml } from '../pageFetcher.js';
import { parseOpenGraph } from '../openGraphParser.js';
import { resolveHttpUrl } from '../html.js';

export function parseLiveballData(html: string, url: URL): LiveballProviderData | null {
  const { document } = parseHTML(html);
  const hero = document.querySelector('.mt-hero');
  if (!hero) return null;
  const teams = ['home', 'away'].map((side) => {
    const element = hero.querySelector(`.mt-side--${side}`);
    const name = element?.querySelector('.mt-side__name')?.textContent?.trim();
    if (!name) return null;
    const src = element?.querySelector('.mt-side__logo img')?.getAttribute('src');
    return { name, logo: resolveHttpUrl(src ?? null, url) };
  });
  if (!teams[0] || !teams[1]) return null;
  const scoreParts = hero.querySelector('.mt-hero__score')?.textContent?.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  const timestamp = Number(hero.querySelector('.mt-hero__date')?.getAttribute('data-ts'));
  const startsAt = Number.isFinite(timestamp) && timestamp > 0 && timestamp < 8640000000000
    ? new Date(timestamp * 1000).toISOString() : null;
  const status = hero.querySelector('.mt-hero__status')?.textContent?.trim() || null;
  const state = hero.getAttribute('data-live-st');
  return { provider: 'liveball', snapshot: {
    teams: [teams[0], teams[1]],
    competition: hero.querySelector('.mt-hero__league')?.textContent?.replace(/\s*·\s*/, ' · ').trim() || null,
    competitionLogo: resolveHttpUrl(hero.querySelector('.mt-hero__head img')?.getAttribute('src') ?? null, url),
    score: scoreParts ? [scoreParts[1]!, scoreParts[2]!] : null,
    status, normalizedStatus: state === 'fin' ? 'over' : null, startsAt,
  } };
}

export const liveballOpenGraphAdapter: OpenGraphProviderAdapter = {
  matches: isLiveballMatchUrl,
  async fetch(url, context) {
    const page = await fetchHtml(url, 'Mozilla/5.0', {}, context);
    return { ...parseOpenGraph(page.html, page.url), providerData: parseLiveballData(page.html, page.url) };
  },
  parse(html, url) {
    return { ...parseOpenGraph(html, url), providerData: parseLiveballData(html, url) };
  },
};

import { readFile } from 'node:fs/promises';

import {
  createPinnedHttpsAgent,
  resolvePublicAddress,
} from '../publicHttp.js';
import { parseHltvCurrentMap } from './hltvHtmlParser.js';
import {
  type HltvScorebotSnapshot,
} from './hltvScorebotParser.js';
import { parseHltvScorebotEndpoint } from './hltvScorebotEndpoint.js';
import { requestHltvScorebotSnapshot } from './hltvScorebotSession.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

const SCOREBOT_CACHE_TTL_MS = 5 * 60_000;
const SCOREBOT_ATTEMPTS = 2;

export type HltvScorebotData = HltvScorebotSnapshot;

type HltvScorebotCacheEntry = {
  expiresAt: number;
  snapshot: HltvScorebotSnapshot;
};

const hltvScorebotCache = new Map<string, HltvScorebotCacheEntry>();

export async function fetchHltvScorebotSnapshot(
  html: string,
  cookiesPath?: string,
  cookieHeader?: string,
  context?: RequestExecutionContext,
): Promise<HltvScorebotData | null> {
  const endpoint = parseHltvScorebotEndpoint(html);
  if (!endpoint) return null;

  const resolvedCookieHeader = cookieHeader ?? (
    cookiesPath ? await readCookieHeader(cookiesPath) : null
  );
  if (!resolvedCookieHeader) return null;

  let address;
  try {
    address = context
      ? await resolvePublicAddress(endpoint.url, context)
      : await resolvePublicAddress(endpoint.url);
  } catch {
    return null;
  }
  const agent = createPinnedHttpsAgent(address);

  const headers = {
    Cookie: resolvedCookieHeader,
    Origin: 'https://www.hltv.org',
    Referer: 'https://www.hltv.org/',
    'User-Agent': TWITTERBOT_USER_AGENT,
  };

  try {
    for (let attempt = 0; attempt < SCOREBOT_ATTEMPTS; attempt += 1) {
      const snapshot = await requestHltvScorebotSnapshot({
        scorebotUrl: endpoint.url,
        scorebotId: endpoint.scorebotId,
        team1Id: endpoint.team1Id,
        html,
        headers,
        agent,
        context,
      });
      if (snapshot) {
        hltvScorebotCache.set(endpoint.scorebotId, {
          expiresAt: Date.now() + SCOREBOT_CACHE_TTL_MS,
          snapshot,
        });
        return snapshot;
      }
    }
  } finally {
    agent.destroy();
  }

  const cached = hltvScorebotCache.get(endpoint.scorebotId);
  if (!cached || cached.expiresAt <= Date.now()) {
    hltvScorebotCache.delete(endpoint.scorebotId);
    return null;
  }
  const htmlCurrentMap = parseHltvCurrentMap(html);
  return !htmlCurrentMap || htmlCurrentMap.name === cached.snapshot.currentMap.name
    ? cached.snapshot
    : null;
}

async function readCookieHeader(cookiesPath: string): Promise<string | null> {
  try {
    return (await readFile(cookiesPath, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((fields) => fields.length >= 7)
      .map((fields) => `${fields[5]}=${fields[6]}`)
      .join('; ') || null;
  } catch {
    return null;
  }
}

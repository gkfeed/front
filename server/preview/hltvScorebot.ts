import { readFile } from 'node:fs/promises';
import * as socketIo from 'socket.io-client';

import {
  createPinnedHttpsAgent,
  resolvePublicAddress,
} from '../publicHttp.js';
import { parseAttributes } from './html.js';
import {
  parseHltvCurrentMap,
} from './hltvHtmlParser.js';
import {
  parseHltvScoreboardSnapshot,
  type HltvScorebotSnapshot,
} from './hltvScorebotParser.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';

const SCOREBOT_TIMEOUT_MS = 2_500;
const MAX_SCOREBOT_PAYLOAD_BYTES = 256_000;
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
): Promise<HltvScorebotData | null> {
  const scoreboardTag = html.match(/<div\b[^>]*\bid=(?:"scoreboardElement"|'scoreboardElement')[^>]*>/i)?.[0];
  if (!scoreboardTag) return null;
  const attributes = parseAttributes(scoreboardTag);
  const scorebotId = attributes['data-scorebot-id'];
  const team1Id = attributes['data-team1-id'];
  const rawUrl = attributes['data-scorebot-url']?.split(',').at(-1)?.trim();
  if (!scorebotId || !team1Id || !rawUrl) return null;

  let scorebotUrl: URL;
  try {
    scorebotUrl = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isValidScorebotUrl(scorebotUrl)) return null;

  const resolvedCookieHeader = cookieHeader ?? (
    cookiesPath ? await readCookieHeader(cookiesPath) : null
  );
  if (!resolvedCookieHeader) return null;

  let address;
  try {
    address = await resolvePublicAddress(scorebotUrl);
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
      const snapshot = await requestHltvScorebotSnapshot(
        scorebotUrl,
        scorebotId,
        team1Id,
        html,
        headers,
        agent,
      );
      if (snapshot) {
        hltvScorebotCache.set(scorebotId, {
          expiresAt: Date.now() + SCOREBOT_CACHE_TTL_MS,
          snapshot,
        });
        return snapshot;
      }
    }
  } finally {
    agent.destroy();
  }

  const cached = hltvScorebotCache.get(scorebotId);
  if (!cached || cached.expiresAt <= Date.now()) {
    hltvScorebotCache.delete(scorebotId);
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

function requestHltvScorebotSnapshot(
  scorebotUrl: URL,
  scorebotId: string,
  team1Id: string,
  html: string,
  headers: Record<string, string>,
  agent: ReturnType<typeof createPinnedHttpsAgent>,
): Promise<HltvScorebotSnapshot | null> {
  return new Promise((resolve) => {
    const socket = socketIo.connect(scorebotUrl.href, {
      reconnection: false,
      timeout: SCOREBOT_TIMEOUT_MS,
      // WebSocket avoids an HTTP redirect-capable polling client. The agent
      // pins the TLS connection to the address validated above.
      transports: ['websocket'],
      transportOptions: {
        websocket: {
          extraHeaders: headers,
          agent,
          maxPayload: MAX_SCOREBOT_PAYLOAD_BYTES,
        },
      },
    });
    let settled = false;
    const finish = (snapshot: HltvScorebotSnapshot | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(snapshot);
    };
    const timeout = setTimeout(() => finish(null), SCOREBOT_TIMEOUT_MS);

    socket.on('connect', () => {
      socket.emit('readyForMatch', JSON.stringify({ token: '', listId: scorebotId }));
    });
    socket.on('scoreboard', (data: unknown) => {
      finish(parseHltvScoreboardSnapshot(data, html, team1Id));
    });
    socket.on('connect_error', () => finish(null));
  });
}

function isValidScorebotUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.hash
    && hostname.endsWith('.hltv.org');
}

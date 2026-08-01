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
import type { RequestContext } from '../requestContext.js';

// HLTV's public Scorebot endpoint still speaks the Socket.IO v2 / Engine.IO
// v3 protocol, so this import intentionally uses socket.io-client 2.x.
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
  context?: RequestContext,
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
    address = context
      ? await resolvePublicAddress(scorebotUrl, context)
      : await resolvePublicAddress(scorebotUrl);
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
        context,
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
  context?: RequestContext,
): Promise<HltvScorebotSnapshot | null> {
  return new Promise((resolve) => {
    const timeoutMs = context?.remainingMs(SCOREBOT_TIMEOUT_MS) ?? SCOREBOT_TIMEOUT_MS;
    const socket = socketIo.connect(scorebotUrl.href, {
      reconnection: false,
      timeout: timeoutMs,
      // HLTV's Scorebot starts with Engine.IO polling and may upgrade to a
      // WebSocket. Keep both transports enabled so the connection works on
      // deployments where the WebSocket upgrade is unavailable. The pinned
      // agent is used for both transports after the endpoint was validated.
      transports: ['polling', 'websocket'],
      transportOptions: {
        polling: {
          extraHeaders: headers,
          agent,
        },
        websocket: {
          extraHeaders: headers,
          agent,
          maxPayload: MAX_SCOREBOT_PAYLOAD_BYTES,
        },
      },
    });
    let settled = false;
    let latestSnapshot: HltvScorebotSnapshot | null = null;
    const finish = (snapshot: HltvScorebotSnapshot | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      context?.signal.removeEventListener('abort', abort);
      resolve(snapshot);
    };
    const timeout = setTimeout(() => finish(latestSnapshot), timeoutMs);
    const abort = () => finish(null);
    context?.signal.addEventListener('abort', abort, { once: true });

    socket.on('connect', () => {
      socket.emit('readyForMatch', JSON.stringify({ token: '', listId: scorebotId }));
    });
    socket.on('scoreboard', (data: unknown) => {
      const snapshot = parseHltvScoreboardSnapshot(data, html, team1Id);
      if (!snapshot) return;
      latestSnapshot = snapshot;
      // Scorebot can send an initial score/map update before its player rows
      // are populated. Keep listening so that the first snapshot does not
      // permanently turn player stats into an empty table.
      if (hasPlayerStats(snapshot)) finish(snapshot);
    });
    socket.on('connect_error', () => finish(null));
  });
}

function hasPlayerStats(snapshot: HltvScorebotSnapshot): boolean {
  return snapshot.playerStats.some((team) => team.length > 0);
}

function isValidScorebotUrl(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  return url.protocol === 'https:'
    && !url.username
    && !url.password
    && !url.hash
    && hostname.endsWith('.hltv.org');
}

import { readFile } from 'node:fs/promises';
import * as socketIo from 'socket.io-client';

import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
} from '../../shared/previewContracts.js';
import { parseAttributes } from './html.js';
import {
  parseHltvCurrentMap,
} from './hltvHtmlParser.js';
import {
  parseHltvScoreboardSnapshot,
  type HltvScorebotSnapshot,
} from './hltvScorebotParser.js';

const SCOREBOT_TIMEOUT_MS = 2_500;
const SCOREBOT_CACHE_TTL_MS = 5 * 60_000;
const SCOREBOT_ATTEMPTS = 2;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';

export type HltvScorebotData = {
  currentMap: HltvCurrentMapPreview;
  playerStats: HltvMatchPlayerStatsPreview;
  teamSides: HltvMatchTeamSidesPreview;
};

type HltvScorebotCacheEntry = {
  expiresAt: number;
  snapshot: HltvScorebotSnapshot;
};

const hltvScorebotCache = new Map<string, HltvScorebotCacheEntry>();

export async function fetchHltvScorebotSnapshot(
  html: string,
  cookiesPath: string,
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
  if (scorebotUrl.protocol !== 'https:' || !scorebotUrl.hostname.toLowerCase().endsWith('.hltv.org')) return null;

  const cookieHeader = await readCookieHeader(cookiesPath);
  if (!cookieHeader) return null;

  const headers = {
    Cookie: cookieHeader,
    Origin: 'https://www.hltv.org',
    Referer: 'https://www.hltv.org/',
    'User-Agent': TWITTERBOT_USER_AGENT,
  };
  for (let attempt = 0; attempt < SCOREBOT_ATTEMPTS; attempt += 1) {
    const snapshot = await requestHltvScorebotSnapshot(scorebotUrl, scorebotId, team1Id, html, headers);
    if (snapshot) {
      hltvScorebotCache.set(scorebotId, {
        expiresAt: Date.now() + SCOREBOT_CACHE_TTL_MS,
        snapshot,
      });
      return snapshot;
    }
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
): Promise<HltvScorebotSnapshot | null> {
  return new Promise((resolve) => {
    const socket = socketIo.connect(scorebotUrl.href, {
      reconnection: false,
      timeout: SCOREBOT_TIMEOUT_MS,
      transportOptions: {
        polling: { extraHeaders: headers },
        websocket: { extraHeaders: headers },
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

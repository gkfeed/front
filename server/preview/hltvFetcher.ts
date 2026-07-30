import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import * as socketIo from 'socket.io-client';

import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvMatchTeamSidesPreview,
} from '../../shared/previewContracts.js';
import { PreviewError } from './errors.js';
import { parseAttributes } from './html.js';
import { responseTooLarge } from './remoteHttp.js';
import {
  parseHltvCurrentMap,
  parseHltvMatchStatus,
  parseHltvScoreboardSnapshot,
  type HltvScorebotSnapshot,
} from './hltvParser.js';

const MAX_HLTV_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 8_000;
const SCOREBOT_TIMEOUT_MS = 2_500;
const SCOREBOT_CACHE_TTL_MS = 5 * 60_000;
const SCOREBOT_ATTEMPTS = 2;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const execFileAsync = promisify(execFile);

interface HltvScorebotCacheEntry {
  expiresAt: number;
  snapshot: HltvScorebotSnapshot;
}

export interface HltvPage {
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
  teamSides: HltvMatchTeamSidesPreview | null;
}

const hltvScorebotCache = new Map<string, HltvScorebotCacheEntry>();

export async function fetchHltvHtml(url: URL): Promise<HltvPage> {
  const directory = await mkdtemp(join(tmpdir(), 'gkfeed-hltv-'));
  const output = join(directory, 'response');
  const cookies = join(directory, 'cookies.txt');
  try {
    await execFileAsync('aria2c', [
      '--quiet=true',
      '--allow-overwrite=true',
      '--auto-file-renaming=false',
      '--max-tries=1',
      '--connect-timeout=8',
      '--timeout=8',
      '--save-cookies',
      cookies,
      '--header',
      `User-Agent: ${TWITTERBOT_USER_AGENT}`,
      '--dir',
      directory,
      '--out',
      'response',
      url.href,
    ], { timeout: REQUEST_TIMEOUT_MS });

    const body = await readFile(output);
    if (body.byteLength > MAX_HLTV_RESPONSE_BYTES) throw responseTooLarge();
    const html = body.toString('utf8');
    const scorebot = parseHltvMatchStatus(html) === 'live'
      ? await fetchHltvScorebotSnapshot(html, cookies)
      : null;
    return {
      html,
      url,
      currentMap: scorebot?.currentMap ?? null,
      playerStats: scorebot?.playerStats ?? null,
      teamSides: scorebot?.teamSides ?? null,
    };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function fetchHltvScorebotSnapshot(
  html: string,
  cookiesPath: string,
): Promise<HltvScorebotSnapshot | null> {
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

  let cookieHeader: string;
  try {
    cookieHeader = (await readFile(cookiesPath, 'utf8'))
      .split(/\r?\n/)
      .map((line) => line.split('\t'))
      .filter((fields) => fields.length >= 7)
      .map((fields) => `${fields[5]}=${fields[6]}`)
      .join('; ');
  } catch {
    return null;
  }
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

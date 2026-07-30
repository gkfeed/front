import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from 'node:zlib';
import * as socketIo from 'socket.io-client';

import type {
  HltvCurrentMapPreview,
  HltvMatchPlayerStatsPreview,
  HltvPlayerStatsPreview,
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from './previewContracts.js';
import { PublicHttpError, requestPublicHttp } from './publicHttp.js';

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_HLTV_RESPONSE_BYTES = 2_000_000;
const MAX_IMAGE_RESPONSE_BYTES = 10_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8_000;
const SCOREBOT_TIMEOUT_MS = 4_000;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';
const execFileAsync = promisify(execFile);

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

interface HltvScorebotSnapshot {
  currentMap: HltvCurrentMapPreview;
  playerStats: HltvMatchPlayerStatsPreview;
}

export class PreviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function fetchOpenGraph(input: string): Promise<OpenGraphPreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  const url = getPreviewUrl(requestedUrl);
  const page: {
    html: string;
    url: URL;
    currentMap?: HltvCurrentMapPreview | null;
    playerStats?: HltvMatchPlayerStatsPreview | null;
  } = isHltvMatchUrl(url)
    ? await fetchHltvHtml(url)
    : await fetchHtml(url, isRezkaUrl(requestedUrl) ? REZKA_USER_AGENT : TWITTERBOT_USER_AGENT);
  const preview = parseOpenGraph(page.html, page.url);
  if (page.currentMap) {
    preview.matchCurrentMap = page.currentMap;
  }
  if (page.playerStats) {
    preview.matchPlayerStats = page.playerStats;
  }
  return preview;
}

export async function fetchLiquipediaMatch(input: string): Promise<LiquipediaMatchPreview> {
  const url = parsePublicHttpUrl(input);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = safeDecodeURIComponent(url.pathname);
  if (hostname !== 'liquipedia.net' || !/\/Match:/i.test(pathname)) {
    throw new PreviewError('Only Liquipedia match pages can be previewed', 400, 'invalid_liquipedia_match');
  }

  const page = await fetchHtml(url);
  const match = parseLiquipediaMatch(page.html, page.url);
  if (!match) {
    throw new PreviewError('The Liquipedia page has no supported match summary', 422, 'match_not_found');
  }
  return match;
}

export async function fetchRedditPreviewImage(input: string): Promise<PreviewImage> {
  let url = parsePublicHttpUrl(input);
  if (url.hostname.toLowerCase() !== 'share.redd.it' || !url.pathname.startsWith('/preview/post/')) {
    throw new PreviewError('Only Reddit preview images can be proxied', 400, 'invalid_reddit_preview');
  }

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Awaited<ReturnType<typeof requestPublicHttp>>;
    try {
      response = await requestPublicHttp(url, {
        accept: 'image/avif,image/webp,image/jpeg,image/png,image/*',
        'user-agent': TWITTERBOT_USER_AGENT,
      });
    } catch (error) {
      throwPublicUrlError(error);
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The Reddit preview image took too long to respond'
        : 'The Reddit preview image could not be fetched';
      throw new PreviewError(message, 502, 'image_fetch_failed');
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError('Reddit returned an invalid image redirect', 502, 'invalid_redirect');
      if (redirects === MAX_REDIRECTS) throw new PreviewError('Reddit redirected the image too many times', 502, 'too_many_redirects');
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(`Reddit returned HTTP ${response.status} for the preview image`, 502, 'image_upstream_error');
    }

    const contentType = firstHeader(response.headers['content-type'])?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!contentType.startsWith('image/')) {
      response.body.resume();
      throw new PreviewError('Reddit did not return an image', 502, 'invalid_image');
    }

    try {
      return {
        body: await readLimitedBytes(response, MAX_IMAGE_RESPONSE_BYTES),
        contentType,
      };
    } catch (error) {
      if (error instanceof PreviewError) throw error;
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The Reddit preview image took too long to respond'
        : 'The Reddit preview image could not be fetched';
      throw new PreviewError(message, 502, 'image_fetch_failed');
    }
  }

  throw new PreviewError('Reddit redirected the image too many times', 502, 'too_many_redirects');
}

async function fetchHtml(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
): Promise<{ html: string; url: URL }> {
  let url = input;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Awaited<ReturnType<typeof requestPublicHttp>>;
    try {
      response = await requestPublicHttp(url, {
        accept: 'text/html,application/xhtml+xml',
        // This is the request profile gkbot uses for feed previews. A number
        // of social sites only include their media metadata for crawler UAs.
        'user-agent': userAgent,
      });
    } catch (error) {
      throwPublicUrlError(error);
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The remote page took too long to respond'
        : 'The remote page could not be fetched';
      throw new PreviewError(message, 502, 'fetch_failed');
    }

    if (isRedirect(response.status)) {
      response.body.resume();
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError('The remote page returned an invalid redirect', 502, 'invalid_redirect');
      if (redirects === MAX_REDIRECTS) throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      throw new PreviewError(`The remote page returned HTTP ${response.status}`, 502, 'upstream_error');
    }

    const contentType = firstHeader(response.headers['content-type'])?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      response.body.resume();
      throw new PreviewError('The URL does not point to an HTML page', 422, 'not_html');
    }

    try {
      const html = await readLimitedBody(response);
      return { html, url };
    } catch (error) {
      if (error instanceof PreviewError) throw error;
      const message = error instanceof PublicHttpError && error.reason === 'timeout'
        ? 'The remote page took too long to respond'
        : 'The remote page could not be fetched';
      throw new PreviewError(message, 502, 'fetch_failed');
    }
  }

  throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
}

async function fetchHltvHtml(
  url: URL,
): Promise<{
  html: string;
  url: URL;
  currentMap: HltvCurrentMapPreview | null;
  playerStats: HltvMatchPlayerStatsPreview | null;
}> {
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
  if (
    scorebotUrl.protocol !== 'https:'
    || !scorebotUrl.hostname.toLowerCase().endsWith('.hltv.org')
  ) return null;

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

  return new Promise((resolve) => {
    const headers = {
      Cookie: cookieHeader,
      Origin: 'https://www.hltv.org',
      Referer: 'https://www.hltv.org/',
      'User-Agent': TWITTERBOT_USER_AGENT,
    };
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

function isHltvMatchUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'hltv.org' &&
    /^\/matches\/\d+(?:\/|$)/.test(url.pathname);
}

function getPreviewUrl(url: URL): URL {
  if (!isRezkaUrl(url)) return url;

  // hdrezka.me does not expose the preview metadata consistently. gkbot gets
  // the same page from Rezka's preview host instead.
  const previewUrl = new URL(url.href);
  previewUrl.host = 'rezka.ag';
  return previewUrl;
}

function isRezkaUrl(url: URL): boolean {
  return url.hostname.toLowerCase().replace(/^www\./, '') === 'hdrezka.me';
}

export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  const isHltvMatch = isHltvMatchUrl(pageUrl);
  const matchStatus = isHltvMatch ? parseHltvMatchStatus(html) : null;
  const structuredVideo = parseVkStructuredVideo(html, pageUrl);
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = (attributes.content ?? attributes.value)?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }

  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = parseRezkaOriginalCover(html, pageUrl) ?? firstMetadata(metadata, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]) ?? structuredVideo?.image ?? null;
  const video = firstMetadata(metadata, [
    'og:video:secure_url',
    'og:video',
    'og:video:url',
    'twitter:player:stream',
  ]) ?? structuredVideo?.embedUrl ?? null;

  return {
    url: pageUrl.href,
    title: firstMetadata(metadata, ['og:title', 'twitter:title']) ??
      (documentTitle ? decodeHtml(stripTags(documentTitle).trim()) : null),
    description: firstMetadata(metadata, ['og:description', 'twitter:description', 'description']),
    image: resolvePreviewImageUrl(image, pageUrl),
    video: resolveHttpUrl(video, pageUrl),
    siteName: metadata.get('og:site_name') ?? null,
    type: metadata.get('og:type') ?? null,
    matchStartsAt: isHltvMatch ? parseHltvMatchStartsAt(html) : null,
    matchTeams: isHltvMatch ? parseHltvMatchTeams(html, pageUrl) : null,
    matchStatus,
    matchScore: matchStatus === 'live' || matchStatus === 'over'
      ? parseHltvMatchScore(html)
      : null,
    matchCurrentMap: matchStatus === 'live' ? parseHltvCurrentMap(html) : null,
    matchPlayerStats: null,
  };
}

function parseVkStructuredVideo(
  html: string,
  pageUrl: URL,
): { embedUrl: string; image: string | null } | null {
  const hostname = pageUrl.hostname.toLowerCase().replace(/^www\./, '');
  if (!['vk.com', 'vk.ru'].includes(hostname)) return null;

  for (const match of html.matchAll(
    /<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    let data: unknown;
    try {
      data = JSON.parse(match[1] ?? '');
    } catch {
      continue;
    }

    const video = findStructuredVideo(data);
    if (!video) continue;
    const embedUrl = getObjectString(video, 'embedUrl');
    if (!embedUrl) continue;

    const resolvedEmbedUrl = resolveHttpUrl(embedUrl, pageUrl);
    if (!resolvedEmbedUrl || !isVkVideoEmbedUrl(resolvedEmbedUrl)) continue;
    const thumbnail = getObjectString(video, 'thumbnailUrl');

    return {
      embedUrl: resolvedEmbedUrl,
      image: resolveHttpUrl(thumbnail, pageUrl),
    };
  }

  return null;
}

function findStructuredVideo(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const video = findStructuredVideo(entry);
      if (video) return video;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;

  const object = value as Record<string, unknown>;
  if (object['@type'] === 'VideoObject') return object;

  for (const key of ['video', '@graph']) {
    const video = findStructuredVideo(object[key]);
    if (video) return video;
  }
  return null;
}

function getObjectString(value: Record<string, unknown>, key: string): string | null {
  const property = value[key];
  return typeof property === 'string' && property.trim() ? property.trim() : null;
}

function isVkVideoEmbedUrl(value: string): boolean {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  return ['vk.com', 'vk.ru', 'vkvideo.ru'].includes(hostname)
    && /^\/(?:video|clip)_ext\.php$/i.test(url.pathname)
    && /^-?\d+$/.test(url.searchParams.get('oid') ?? '')
    && /^\d+$/.test(url.searchParams.get('id') ?? '');
}

function resolvePreviewImageUrl(value: string | null | undefined, base: URL): string | null {
  const resolved = resolveHttpUrl(value, base);
  if (!resolved) return null;

  const url = new URL(resolved);
  if (url.protocol === 'http:' && isVkImageHost(url.hostname)) {
    url.protocol = 'https:';
  }
  return url.href;
}

function isVkImageHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'vkuserphoto.ru'
    || normalized.endsWith('.vkuserphoto.ru')
    || normalized === 'userapi.com'
    || normalized.endsWith('.userapi.com');
}

function parseHltvMatchStatus(html: string): OpenGraphPreview['matchStatus'] {
  const countdown = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bcountdown\b[^"]*"|'[^']*\bcountdown\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1];
  switch (htmlText(countdown ?? '').toLowerCase()) {
    case 'live': return 'live';
    case 'match over': return 'over';
    case 'match postponed': return 'postponed';
    case 'match deleted': return 'deleted';
    default: return 'scheduled';
  }
}

function parseHltvMatchScore(html: string): OpenGraphPreview['matchScore'] {
  let firstTeamMaps = 0;
  let secondTeamMaps = 0;

  getHltvMapSections(html).forEach((map) => {
    // During a live map HLTV also marks the currently leading side as "won".
    // A stats link is added once the map is actually complete.
    if (!hasHltvCompletedMap(map)) {
      return;
    }
    if (hasHltvResultClass(map, 'results-left', 'won')) firstTeamMaps += 1;
    if (hasHltvResultClass(map, 'results-right', 'won')) secondTeamMaps += 1;
  });

  return [String(firstTeamMaps), String(secondTeamMaps)];
}

function parseHltvCurrentMap(html: string): OpenGraphPreview['matchCurrentMap'] {
  const maps = getHltvMapSections(html).map((map) => {
    if (hasHltvCompletedMap(map)) return null;
    const nameMarkup = map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const scores = [...map.matchAll(
      /<div\b[^>]*class=(?:"[^"]*\bresults-team-score\b[^"]*"|'[^']*\bresults-team-score\b[^']*')[^>]*>([\s\S]*?)<\/div>/gi,
    )].map((match) => htmlText(match[1] ?? ''));
    const name = htmlText(nameMarkup ?? '');
    if (!name || scores.length < 2 || !scores.slice(0, 2).every((score) => /^\d+$/.test(score))) {
      return null;
    }
    return {
      name,
      score: [scores[0]!, scores[1]!] as [string, string],
    };
  });

  for (let index = maps.length - 1; index >= 0; index -= 1) {
    const map = maps[index];
    if (map) return map;
  }
  return null;
}

export function parseHltvScoreboardUpdate(
  value: unknown,
  html: string,
  team1Id: string,
): HltvCurrentMapPreview | null {
  return parseHltvScoreboardSnapshot(value, html, team1Id)?.currentMap ?? null;
}

export function parseHltvScoreboardSnapshot(
  value: unknown,
  html: string,
  team1Id: string,
): HltvScorebotSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const scoreboard = value as Record<string, unknown>;
  const mapName = typeof scoreboard.mapName === 'string' ? scoreboard.mapName : '';
  const ctTeamId = Number(scoreboard.ctTeamId);
  const terroristTeamId = Number(scoreboard.tTeamId);
  const ctScore = Number(scoreboard.ctTeamScore ?? scoreboard.counterTerroristScore);
  const terroristScore = Number(scoreboard.tTeamScore ?? scoreboard.terroristScore);
  const firstTeamId = Number(team1Id);
  if (
    !mapName
    || ![ctTeamId, terroristTeamId, ctScore, terroristScore, firstTeamId].every(Number.isFinite)
    || ![ctTeamId, terroristTeamId].includes(firstTeamId)
  ) return null;

  const mapSlug = mapName.replace(/^de_/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const displayName = getHltvMapSections(html)
    .map((map) => htmlText(map.match(
      /<div\b[^>]*class=(?:"[^"]*\bmapname\b[^"]*"|'[^']*\bmapname\b[^']*')[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1] ?? ''))
    .find((name) => name.replace(/[^a-z0-9]/gi, '').toLowerCase() === mapSlug)
    ?? mapName.replace(/^de_/, '').replace(/^./, (letter) => letter.toUpperCase());
  const score: [string, string] = firstTeamId === ctTeamId
    ? [String(ctScore), String(terroristScore)]
    : [String(terroristScore), String(ctScore)];

  const ctPlayers = parseHltvScoreboardPlayers(scoreboard.CT);
  const terroristPlayers = parseHltvScoreboardPlayers(scoreboard.TERRORIST);
  const playerStats: HltvMatchPlayerStatsPreview = firstTeamId === ctTeamId
    ? [ctPlayers, terroristPlayers]
    : [terroristPlayers, ctPlayers];

  return {
    currentMap: { name: displayName, score },
    playerStats,
  };
}

function parseHltvScoreboardPlayers(value: unknown): HltvPlayerStatsPreview[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const player = entry as Record<string, unknown>;
    const nickname = typeof player.nick === 'string' && player.nick.trim()
      ? player.nick.trim()
      : typeof player.name === 'string' ? player.name.trim() : '';
    const kills = Number(player.score);
    const deaths = Number(player.deaths);
    const assists = Number(player.assists);
    const adr = Number(player.damagePrRound);
    if (
      !nickname
      || ![kills, deaths, assists, adr].every(Number.isFinite)
    ) return [];
    return [{
      nickname,
      kills,
      deaths,
      assists,
      adr: Math.round(adr * 10) / 10,
    }];
  });
}

function getHltvMapSections(html: string): string[] {
  const mapStarts = [...html.matchAll(
    /<div\b[^>]*class=(?:"[^"]*\bmapholder\b[^"]*"|'[^']*\bmapholder\b[^']*')[^>]*>/gi,
  )];
  return mapStarts.map((match, index) => {
    const start = match.index ?? 0;
    const end = mapStarts[index + 1]?.index ?? Math.min(html.length, start + 20_000);
    return html.slice(start, end);
  });
}

function hasHltvCompletedMap(html: string): boolean {
  const links = html.match(/<a\b[^>]*>/gi) ?? [];
  return links.some((tag) => {
    const attributes = parseAttributes(tag);
    return Boolean(
      attributes.href
      && attributes.class?.split(/\s+/).includes('results-stats'),
    );
  });
}

function hasHltvResultClass(html: string, sideClass: string, resultClass: string): boolean {
  const openingTags = html.match(/<(?:div|span)\b[^>]*class=(?:"[^"]*"|'[^']*')[^>]*>/gi) ?? [];
  return openingTags.some((tag) => {
    const classes = parseAttributes(tag).class?.split(/\s+/) ?? [];
    return classes.includes(sideClass) && classes.includes(resultClass);
  });
}

function parseRezkaOriginalCover(html: string, pageUrl: URL): string | null {
  if (pageUrl.hostname.toLowerCase().replace(/^www\./, '') !== 'rezka.ag') return null;

  const coverStart = html.match(
    /<div\b[^>]*class=(?:"[^"]*\bb-sidecover\b[^"]*"|'[^']*\bb-sidecover\b[^']*')[^>]*>/i,
  );
  if (!coverStart || coverStart.index === undefined) return null;

  const coverMarkup = html.slice(coverStart.index, coverStart.index + 2_000);
  const linkTag = coverMarkup.match(/<a\b[^>]*>/i)?.[0];
  const href = linkTag ? parseAttributes(linkTag).href : null;
  return resolveHttpUrl(href ? decodeHtml(href) : null, pageUrl);
}

function parseHltvMatchStartsAt(html: string): string | null {
  const sectionMatch = /<div\b[^>]*class=(?:"[^"]*\btimeAndEvent\b[^"]*"|'[^']*\btimeAndEvent\b[^']*')[^>]*>/i.exec(html);
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const section = html.slice(sectionMatch.index, sectionMatch.index + 2_000);
  const unixValue = section.match(/\bdata-unix=(?:"(\d{10,13})"|'(\d{10,13})')/i);
  const rawTimestamp = unixValue?.[1] ?? unixValue?.[2];
  if (!rawTimestamp) return null;

  const timestamp = Number(rawTimestamp) * (rawTimestamp.length === 10 ? 1_000 : 1);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function parseHltvMatchTeams(
  html: string,
  pageUrl: URL,
): OpenGraphPreview['matchTeams'] {
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

    return {
      name,
      logo: resolveHttpUrl(decodeHtml(preferredLogo?.src ?? ''), pageUrl),
    };
  });

  return teams[0] && teams[1] ? [teams[0], teams[1]] : null;
}

export function parseLiquipediaMatch(
  html: string,
  pageUrl: URL,
): LiquipediaMatchPreview | null {
  const headerStart = html.indexOf('<div class="match-bm">');
  if (headerStart < 0) return null;

  const headerEnd = html.indexOf('<div class="toggle-area', headerStart);
  const header = html.slice(headerStart, headerEnd < 0 ? undefined : headerEnd);
  const dateMarkup = header.match(/match-bm-match-header-date"[^>]*>([\s\S]*?)<div class="match-bm-match-header-overview"/i)?.[1];
  const resultMatch = header.match(/match-bm-match-header-result"[^>]*>\s*([^<]+)<div class="match-bm-match-header-result-text"[^>]*>([\s\S]*?)<\/div>/i);
  const tournamentMarkup = header.match(/match-bm-match-header-tournament"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const teamNamePattern = /match-bm-match-header-team-long"[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  const teamNameMatches = [...header.matchAll(teamNamePattern)].slice(0, 2);

  if (!dateMarkup || !resultMatch || !tournamentMarkup || teamNameMatches.length !== 2) return null;

  const teams = teamNameMatches.map((match, index) => {
    const matchIndex = match.index ?? 0;
    const nextIndex = teamNameMatches[index + 1]?.index ?? header.length;
    const opponentStart = header.lastIndexOf('match-bm-match-header-opponent ', matchIndex);
    const segment = header.slice(Math.max(opponentStart, 0), nextIndex);
    const name = htmlText(match[1] ?? '');
    const shortNameMarkup = segment.match(/match-bm-match-header-team-short"[^>]*>\s*<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const imageSources = [...segment.matchAll(/<img\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)]
      .map((image) => image[1] ?? image[2] ?? '');
    const preferredImage = imageSources.find((source) => /darkmode/i.test(source)) ?? imageSources[0];
    const results = [...segment.matchAll(/data-label-type=(?:"result-(win|loss|default)"|'result-(win|loss|default)')/gi)]
      .map((label) => (label[1] ?? label[2])!.toLowerCase() as 'win' | 'loss' | 'default');

    return {
      name,
      shortName: htmlText(shortNameMarkup ?? name),
      logo: preferredImage ? resolveHttpUrl(decodeHtml(preferredImage), pageUrl) : null,
      results,
    };
  });
  const score = htmlText(resultMatch[1] ?? '').split(':').map((part) => part.trim());
  if (score.length !== 2 || teams.some((team) => !team.name)) return null;

  return {
    date: htmlText(dateMarkup),
    status: htmlText(resultMatch[2] ?? ''),
    score: [score[0]!, score[1]!],
    teams: [teams[0]!, teams[1]!],
    tournament: htmlText(tournamentMarkup),
  };
}

function firstMetadata(metadata: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata.get(key);
    if (value) return value;
  }
  return null;
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) attributes[name] = value;
  }
  return attributes;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' };
  return value.replace(/&(#\d+|#x[\da-f]+|amp|apos|gt|lt|quot);/gi, (entity, code: string) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const radix = code[1]?.toLowerCase() === 'x' ? 16 : 10;
    const number = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
    return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
  });
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

function htmlText(value: string): string {
  return decodeHtml(stripTags(value)).replace(/\s+/g, ' ').trim();
}

function resolveHttpUrl(value: string | null | undefined, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError('A valid URL is required', 400, 'invalid_url');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PreviewError('Only public HTTP and HTTPS URLs are allowed', 400, 'invalid_url');
  }
  return url;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedBody(response: Awaited<ReturnType<typeof requestPublicHttp>>): Promise<string> {
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > MAX_RESPONSE_BYTES) {
    response.body.destroy();
    throw responseTooLarge();
  }
  const body = getDecodedBody(response);
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';

  for await (const chunk of body) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      body.destroy();
      throw responseTooLarge();
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

function getDecodedBody(response: Awaited<ReturnType<typeof requestPublicHttp>>) {
  const encoding = firstHeader(response.headers['content-encoding'])?.trim().toLowerCase();
  if (encoding === 'gzip' || encoding === 'x-gzip') return response.body.pipe(createGunzip());
  if (encoding === 'deflate') return response.body.pipe(createInflate());
  if (encoding === 'br') return response.body.pipe(createBrotliDecompress());
  return response.body;
}

async function readLimitedBytes(
  response: Awaited<ReturnType<typeof requestPublicHttp>>,
  maximumBytes: number,
): Promise<Uint8Array> {
  const declaredLength = Number(firstHeader(response.headers['content-length']));
  if (declaredLength > maximumBytes) {
    response.body.destroy();
    throw imageTooLarge();
  }
  const chunks: Uint8Array[] = [];
  let size = 0;

  for await (const chunk of response.body) {
    const value = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += value.byteLength;
    if (size > maximumBytes) {
      response.body.destroy();
      throw imageTooLarge();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function throwPublicUrlError(error: unknown): void {
  if (!(error instanceof PublicHttpError)) return;
  if (error.reason === 'private') {
    throw new PreviewError('Private or local network URLs are not allowed', 403, 'private_url');
  }
  if (error.reason === 'unresolvable') {
    throw new PreviewError('The URL hostname could not be resolved', 422, 'unresolvable_host');
  }
}

function responseTooLarge(): PreviewError {
  return new PreviewError('The remote page is too large to preview', 422, 'response_too_large');
}

function imageTooLarge(): PreviewError {
  return new PreviewError('The Reddit preview image is too large', 422, 'image_too_large');
}

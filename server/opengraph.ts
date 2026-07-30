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

import type {
  LiquipediaMatchPreview,
  OpenGraphPreview,
} from './previewContracts.js';
import { PublicHttpError, requestPublicHttp } from './publicHttp.js';

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_HLTV_RESPONSE_BYTES = 2_000_000;
const MAX_IMAGE_RESPONSE_BYTES = 10_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8_000;
const TWITTERBOT_USER_AGENT = 'Mozilla/5.0 (compatible; Twitterbot/1.0)';
const REZKA_USER_AGENT = 'TelegramBot (like TwitterBot)';
const execFileAsync = promisify(execFile);

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
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
  const page = isHltvMatchUrl(url)
    ? await fetchHltvHtml(url)
    : await fetchHtml(url, isRezkaUrl(requestedUrl) ? REZKA_USER_AGENT : TWITTERBOT_USER_AGENT);
  return parseOpenGraph(page.html, page.url);
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

async function fetchHltvHtml(url: URL): Promise<{ html: string; url: URL }> {
  const directory = await mkdtemp(join(tmpdir(), 'gkfeed-hltv-'));
  const output = join(directory, 'response');
  try {
    await execFileAsync('aria2c', [
      '--quiet=true',
      '--allow-overwrite=true',
      '--auto-file-renaming=false',
      '--max-tries=1',
      '--connect-timeout=8',
      '--timeout=8',
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
    return { html: body.toString('utf8'), url };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('The HLTV page could not be fetched', 502, 'fetch_failed');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = (attributes.content ?? attributes.value)?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }

  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = firstMetadata(metadata, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]);
  const video = firstMetadata(metadata, [
    'og:video:secure_url',
    'og:video',
    'og:video:url',
    'twitter:player:stream',
  ]);

  return {
    url: pageUrl.href,
    title: firstMetadata(metadata, ['og:title', 'twitter:title']) ??
      (documentTitle ? decodeHtml(stripTags(documentTitle).trim()) : null),
    description: firstMetadata(metadata, ['og:description', 'twitter:description', 'description']),
    image: resolveHttpUrl(image, pageUrl),
    video: resolveHttpUrl(video, pageUrl),
    siteName: metadata.get('og:site_name') ?? null,
    type: metadata.get('og:type') ?? null,
    matchStartsAt: isHltvMatchUrl(pageUrl) ? parseHltvMatchStartsAt(html) : null,
  };
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

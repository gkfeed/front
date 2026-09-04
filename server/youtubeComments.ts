import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { REMOTE_REQUEST_TIMEOUT_MS } from './timeouts.js';
import { isRecord } from '../shared/valueGuards.js';
import type { YoutubeComment, YoutubeCommentsPreview } from '../shared/youtubeContracts.js';

const COMMENT_LIMIT = 20;
const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

export async function fetchYoutubeComments(
  input: string,
  context?: RequestExecutionContext,
): Promise<YoutubeCommentsPreview> {
  const videoId = parseYoutubeVideoId(input);
  const watchUrl = new URL('https://www.youtube.com/watch');
  watchUrl.searchParams.set('v', videoId);
  watchUrl.searchParams.set('hl', 'en');

  try {
    const html = await fetchYoutubeText(watchUrl, context);
    const initialData = parseAssignedJson(html, 'ytInitialData');
    const config = parseYoutubeConfig(html);
    const continuation = findContinuation(initialData);
    if (!continuation || !config.apiKey || !config.context) return { comments: [] };

    const nextUrl = new URL('https://www.youtube.com/youtubei/v1/next');
    nextUrl.searchParams.set('key', config.apiKey);
    const body = await fetchYoutubeJson(nextUrl, {
      context: config.context,
      continuation,
    }, context);
    return { comments: parseYoutubeComments(body) };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('YouTube comments could not be fetched', 'comments_fetch_failed');
  }
}

export function parseYoutubeComments(value: unknown): YoutubeComment[] {
  const entities = findAllByKey(value, 'commentEntityPayload');
  if (entities.length > 0) {
    return entities.slice(0, COMMENT_LIMIT).flatMap((entity) => {
      if (!isRecord(entity) || !isRecord(entity.properties) || !isRecord(entity.author)) return [];
      const content = isRecord(entity.properties.content) ? entity.properties.content.content : null;
      const id = stringValue(entity.properties.commentId);
      const text = stringValue(content);
      const author = stringValue(entity.author.displayName);
      if (!id || !text || !author) return [];
      const toolbar = isRecord(entity.toolbar) ? entity.toolbar : {};
      return [{
        id,
        text,
        author,
        avatarUrl: stringValue(entity.author.avatarThumbnailUrl) || null,
        publishedTime: stringValue(entity.properties.publishedTime) || null,
        likeCount: stringValue(toolbar.likeCountNotliked) || null,
      }];
    });
  }

  const renderers = findAllByKey(value, 'commentRenderer');
  return renderers.slice(0, COMMENT_LIMIT).flatMap((renderer) => {
    if (!isRecord(renderer)) return [];
    const id = stringValue(renderer.commentId);
    const text = runsText(renderer.contentText);
    const author = runsText(renderer.authorText);
    if (!id || !text || !author) return [];
    return [{
      id,
      text,
      author,
      avatarUrl: thumbnailUrl(renderer.authorThumbnail),
      publishedTime: runsText(renderer.publishedTimeText) || null,
      likeCount: runsText(renderer.voteCount) || null,
    }];
  });
}

function parseYoutubeVideoId(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new PreviewError('Invalid YouTube video URL', 'invalid_youtube_url');
  }
  const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  const videoId = hostname === 'youtu.be'
    ? url.pathname.split('/').filter(Boolean)[0]
    : ['youtube.com', 'm.youtube.com'].includes(hostname)
      ? url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/)?.[1]
      : null;
  if (!videoId || !/^[\w-]{6,}$/.test(videoId)) {
    throw new PreviewError('Invalid YouTube video URL', 'invalid_youtube_url');
  }
  return videoId;
}

function parseYoutubeConfig(html: string): { apiKey: string | null; context: unknown | null } {
  let offset = 0;
  let apiKey: string | null = null;
  let context: unknown | null = null;
  while (offset < html.length && (!apiKey || !context)) {
    const markerIndex = html.indexOf('ytcfg.set(', offset);
    if (markerIndex < 0) break;
    const config = parseAssignedJson(html.slice(markerIndex), 'ytcfg.set(');
    if (isRecord(config)) {
      apiKey ||= stringValue(config.INNERTUBE_API_KEY) || null;
      context ||= isRecord(config.INNERTUBE_CONTEXT) ? config.INNERTUBE_CONTEXT : null;
    }
    offset = markerIndex + 'ytcfg.set('.length;
  }
  return { apiKey, context };
}

function parseAssignedJson(html: string, marker: string): unknown {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = html.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function findContinuation(value: unknown): string | null {
  const commentSections = findAllByKey(value, 'itemSectionRenderer').filter((section) => (
    isRecord(section) && section.sectionIdentifier === 'comment-item-section'
  ));
  for (const continuation of findAllByKey(commentSections, 'continuationCommand')) {
    if (isRecord(continuation) && typeof continuation.token === 'string') return continuation.token;
  }
  return null;
}

function findAllByKey(value: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    for (const [candidateKey, nested] of Object.entries(candidate)) {
      if (candidateKey === key) found.push(nested);
      visit(nested);
    }
  };
  visit(value);
  return found;
}

function runsText(value: unknown): string {
  if (!isRecord(value)) return '';
  if (typeof value.simpleText === 'string') return value.simpleText.trim();
  if (!Array.isArray(value.runs)) return '';
  return value.runs.map((run) => isRecord(run) && typeof run.text === 'string' ? run.text : '').join('').trim();
}

function thumbnailUrl(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.thumbnails)) return null;
  const thumbnail = value.thumbnails.at(-1);
  return isRecord(thumbnail) && typeof thumbnail.url === 'string' ? thumbnail.url : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function fetchYoutubeText(url: URL, context?: RequestExecutionContext): Promise<string> {
  const response = await fetch(url, requestInit(context));
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  return response.text();
}

async function fetchYoutubeJson(url: URL, body: unknown, context?: RequestExecutionContext): Promise<unknown> {
  const response = await fetch(url, {
    ...requestInit(context),
    method: 'POST',
    headers: { ...requestHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  return response.json();
}

function requestInit(context?: RequestExecutionContext): RequestInit {
  const timeout = AbortSignal.timeout(context?.remainingMs(REMOTE_REQUEST_TIMEOUT_MS) ?? REMOTE_REQUEST_TIMEOUT_MS);
  return { headers: requestHeaders(), signal: context ? AbortSignal.any([context.signal, timeout]) : timeout };
}

function requestHeaders(): Record<string, string> {
  return { 'accept-language': 'en-US,en;q=0.9', 'user-agent': YOUTUBE_USER_AGENT };
}

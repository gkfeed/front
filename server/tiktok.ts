import { PublicHttpError, requestPublicHttp } from './publicHttp.js';
import { PreviewError } from './preview/errors.js';

const MAX_RESPONSE_BYTES = 1_000_000;
const COMMENT_LIMIT = 10;

export type TikTokComment = {
  id: string;
  text: string;
  author: string;
  username: string;
  avatarUrl: string | null;
};

type TikTokDetails = {
  description: string | null;
  creatorName: string | null;
  creatorAvatarUrl: string | null;
};

export async function fetchTikTokComments(
  input: string,
): Promise<{ comments: TikTokComment[] } & TikTokDetails> {
  const videoUrl = parseTikTokVideoUrl(input);
  const detailsPromise = fetchTikTokDetails(videoUrl);
  const upstream = new URL('https://www.tikwm.com/api/comment/list');
  upstream.searchParams.set('url', videoUrl.href);
  upstream.searchParams.set('count', String(COMMENT_LIMIT));
  upstream.searchParams.set('cursor', '0');

  let response: Awaited<ReturnType<typeof requestPublicHttp>>;
  try {
    response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
  } catch (error) {
    const message = error instanceof PublicHttpError && error.reason === 'timeout'
      ? 'TikTok comments took too long to respond'
      : 'TikTok comments could not be fetched';
    throw new PreviewError(message, 502, 'comments_fetch_failed');
  }

  if (response.status < 200 || response.status >= 300) {
    response.body.resume();
    throw new PreviewError('The comments provider returned an error', 502, 'comments_upstream_error');
  }

  const body = await readLimitedJson(response);
  return {
    comments: parseTikTokComments(body),
    ...await detailsPromise,
  };
}

export function parseTikTokComments(value: unknown): TikTokComment[] {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data) || !Array.isArray(value.data.comments)) {
    throw new PreviewError('The comments provider returned invalid data', 502, 'invalid_comments');
  }

  return value.data.comments.slice(0, COMMENT_LIMIT).flatMap((comment) => {
    if (!isRecord(comment) || typeof comment.id !== 'string' || typeof comment.text !== 'string') return [];
    const user = isRecord(comment.user) ? comment.user : {};
    const author = typeof user.nickname === 'string' && user.nickname.trim()
      ? user.nickname.trim()
      : typeof user.unique_id === 'string' && user.unique_id.trim()
        ? user.unique_id.trim()
        : 'TikTok user';
    const username = typeof user.unique_id === 'string' ? user.unique_id.trim() : '';
    const avatarUrl = typeof user.avatar === 'string' ? safeHttpUrl(user.avatar) : null;

    return comment.text.trim() ? [{
      id: comment.id,
      text: comment.text.trim(),
      author,
      username,
      avatarUrl,
    }] : [];
  });
}

export function parseTikTokDescription(value: unknown): string | null {
  if (!isRecord(value) || typeof value.title !== 'string') return null;
  return value.title.replace(/\s+/g, ' ').trim() || null;
}

export function parseTikTokDetails(value: unknown): TikTokDetails | null {
  if (!isRecord(value) || value.code !== 0 || !isRecord(value.data)) return null;
  const author = isRecord(value.data.author) ? value.data.author : {};
  return {
    description: typeof value.data.title === 'string'
      ? value.data.title.replace(/\s+/g, ' ').trim() || null
      : null,
    creatorName: typeof author.nickname === 'string'
      ? author.nickname.replace(/\s+/g, ' ').trim() || null
      : null,
    creatorAvatarUrl: typeof author.avatar === 'string' ? safeHttpUrl(author.avatar) : null,
  };
}

async function fetchTikTokDetails(videoUrl: URL): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tikwm.com/api/');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
    if (response.status >= 200 && response.status < 300) {
      const details = parseTikTokDetails(await readLimitedJson(response));
      if (details) return details;
    } else {
      response.body.resume();
    }
  } catch {
    // Fall through to TikTok's official oEmbed metadata.
  }

  return fetchTikTokOEmbedDetails(videoUrl);
}

async function fetchTikTokOEmbedDetails(videoUrl: URL): Promise<TikTokDetails> {
  const upstream = new URL('https://www.tiktok.com/oembed');
  upstream.searchParams.set('url', videoUrl.href);

  try {
    const response = await requestPublicHttp(upstream, {
      accept: 'application/json',
      'user-agent': 'GKFeed/1.0',
    });
    if (response.status < 200 || response.status >= 300) {
      response.body.resume();
      return emptyTikTokDetails();
    }
    const value = await readLimitedJson(response);
    return {
      description: parseTikTokDescription(value),
      creatorName: isRecord(value) && typeof value.author_name === 'string'
        ? value.author_name.replace(/\s+/g, ' ').trim() || null
        : null,
      creatorAvatarUrl: null,
    };
  } catch {
    return emptyTikTokDetails();
  }
}

function emptyTikTokDetails(): TikTokDetails {
  return { description: null, creatorName: null, creatorAvatarUrl: null };
}

function parseTikTokVideoUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError('A valid TikTok video URL is required', 400, 'invalid_tiktok_url');
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (
    (hostname !== 'tiktok.com' && !hostname.endsWith('.tiktok.com'))
    || !/\/video\/\d+/.test(url.pathname)
    || !['http:', 'https:'].includes(url.protocol)
  ) {
    throw new PreviewError('A valid TikTok video URL is required', 400, 'invalid_tiktok_url');
  }
  return url;
}

async function readLimitedJson(
  response: Awaited<ReturnType<typeof requestPublicHttp>>,
): Promise<unknown> {
  let size = 0;
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.body) {
    const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += bytes.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      response.body.destroy();
      throw new PreviewError('The comments response was too large', 502, 'comments_too_large');
    }
    chunks.push(bytes);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new PreviewError('The comments provider returned invalid data', 502, 'invalid_comments');
  }
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

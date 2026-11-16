import { isRecord } from '../shared/valueGuards.js';
import { isTikTokAvatarUrl, type TikTokComment } from '../shared/tiktokContracts.js';
import { normalizeExternalText } from '../shared/text.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { discardResponseBody, requestPublicHttp } from './publicHttp.js';
import { readLimitedBody, readLimitedJson } from './preview/bodyAdapters.js';
import { PreviewError } from './preview/errors.js';
import { TIKTOK_DIRECT_USER_AGENT } from './tiktokDirectPlayback.js';
import type { TikTokDetails } from './tiktokDetailsParser.js';

function limitedContext(context?: RequestExecutionContext): RequestExecutionContext {
  const timeout = AbortSignal.timeout(2500);
  const deadline = Math.min(context?.deadline ?? Infinity, Date.now() + 2500);
  return {
    signal: context ? AbortSignal.any([context.signal, timeout]) : timeout,
    deadline,
    remainingMs: (maximum = Infinity) => Math.min(maximum, Math.max(0, deadline - Date.now())),
  };
}

export async function fetchTikTokWebComments(post: URL, context?: RequestExecutionContext): Promise<TikTokComment[] | null> {
  const id = post.pathname.match(/\/(?:video|v)\/(\d+)/)?.[1];
  if (!id) return null;
  const url = new URL('https://www.tiktok.com/api/comment/list/');
  url.search = new URLSearchParams({ aid: '1988', aweme_id: id, count: '10', cursor: '0' }).toString();
  const requestContext = limitedContext(context);
  const response = await requestPublicHttp(url, {
    'user-agent': TIKTOK_DIRECT_USER_AGENT, accept: 'application/json', referer: 'https://www.tiktok.com/',
  }, requestContext);
  if (response.status !== 200) { discardResponseBody(response.body); return null; }
  const value = await readLimitedJson(response, {
    maximumBytes: 1_000_000, context: requestContext,
    tooLarge: () => new PreviewError('Comments are too large', 'comments_too_large'),
    invalidJson: () => new PreviewError('Invalid comments response', 'invalid_comments'),
  });
  if (!isRecord(value) || value.status_code !== 0
    || !(Array.isArray(value.comments) || (value.comments === null && value.total === 0))) return null;
  if (!Array.isArray(value.comments)) return [];
  return value.comments.slice(0, 10).flatMap((comment): TikTokComment[] => {
    if (!isRecord(comment) || typeof comment.cid !== 'string' || typeof comment.text !== 'string') return [];
    const text = normalizeExternalText(comment.text);
    if (!text) return [];
    const user = isRecord(comment.user) ? comment.user : {};
    const username = typeof user.unique_id === 'string' ? normalizeExternalText(user.unique_id) : '';
    const author = typeof user.nickname === 'string' ? normalizeExternalText(user.nickname) || username : username;
    const avatar = isRecord(user.avatar_thumb) && Array.isArray(user.avatar_thumb.url_list)
      ? user.avatar_thumb.url_list.find(isTikTokAvatarUrl) ?? null : null;
    return [{ id: comment.cid, text, author: author || 'TikTok user', username, avatarUrl: avatar }];
  });
}

export async function fetchTikTokWebDetails(post: URL, context?: RequestExecutionContext): Promise<TikTokDetails | null> {
  const canonical = new URL('https://www.tiktok.com');
  canonical.pathname = post.pathname;
  const requestContext = limitedContext(context);
  const response = await requestPublicHttp(canonical, {
    'user-agent': TIKTOK_DIRECT_USER_AGENT, accept: 'text/html',
  }, requestContext);
  if (response.status !== 200) { discardResponseBody(response.body); return null; }
  const html = await readLimitedBody(response, { maxBytes: 2_000_000, context: requestContext });
  const script = html.match(/<script\b[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) return null;
  let root: unknown;
  try { root = JSON.parse(script); } catch { return null; }
  if (!isRecord(root) || !isRecord(root.__DEFAULT_SCOPE__)) return null;
  const detail = root.__DEFAULT_SCOPE__['webapp.video-detail'];
  if (!isRecord(detail) || !isRecord(detail.itemInfo) || !isRecord(detail.itemInfo.itemStruct)) return null;
  const item = detail.itemInfo.itemStruct;
  if (item.id !== post.pathname.match(/\/(?:video|v)\/(\d+)/)?.[1]) return null;
  const author = isRecord(item.author) ? item.author : {};
  return {
    description: typeof item.desc === 'string' ? normalizeExternalText(item.desc) || null : null,
    creatorName: typeof author.nickname === 'string' ? normalizeExternalText(author.nickname) || null : null,
    creatorAvatarUrl: isTikTokAvatarUrl(author.avatarThumb) ? author.avatarThumb : null,
  };
}

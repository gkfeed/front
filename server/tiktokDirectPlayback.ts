import { isTikTokAvatarUrl, isTikTokMediaUrl, type TikTokPlaybackPreview } from '../shared/tiktokContracts.js';
import { isRecord } from '../shared/valueGuards.js';
import { normalizeExternalText } from '../shared/text.js';
import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { discardResponseBody, requestPublicHttp } from './publicHttp.js';
import { readLimitedBody } from './preview/bodyAdapters.js';

export const TIKTOK_DIRECT_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const sessions = new Map<string, { cookie: string; expires: number }>();
const SESSION_LIFETIME_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 500;

/** Only return an anonymous session for the exact media URL obtained from TikTok. */
export function getTikTokMediaCookie(url: string): string | undefined {
  const session = sessions.get(url);
  if (!session) return undefined;
  if (session.expires <= Date.now()) { sessions.delete(url); return undefined; }
  return session.cookie;
}

export async function fetchTikTokDirectPlayback(post: URL, context?: RequestExecutionContext): Promise<TikTokPlaybackPreview | null> {
  const canonical = new URL('https://www.tiktok.com');
  canonical.pathname = post.pathname;
  const timeout = AbortSignal.timeout(2500);
  const signal = context ? AbortSignal.any([context.signal, timeout]) : timeout;
  const deadline = Math.min(context?.deadline ?? Infinity, Date.now() + 2500);
  const localContext: RequestExecutionContext = {
    signal, deadline,
    remainingMs: (maximum = Infinity) => Math.min(maximum, Math.max(0, deadline - Date.now())),
  };
  const response = await requestPublicHttp(canonical, {
    'user-agent': TIKTOK_DIRECT_USER_AGENT,
    accept: 'text/html',
  }, localContext);
  if (response.status !== 200) { discardResponseBody(response.body); return null; }
  const cookie = response.headers['set-cookie']?.find((entry) => entry.startsWith('tt_chain_token='))?.split(';', 1)[0];
  if (!cookie || !/^tt_chain_token=[A-Za-z0-9%._~+=/-]+$/.test(cookie)) { discardResponseBody(response.body); return null; }
  const html = await readLimitedBody(response, { maxBytes: 2_000_000, context: localContext });
  const script = html.match(/<script\b[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!script) return null;
  let root: unknown;
  try { root = JSON.parse(script); } catch { return null; }
  if (!isRecord(root) || !isRecord(root.__DEFAULT_SCOPE__)) return null;
  const details = root.__DEFAULT_SCOPE__['webapp.video-detail'];
  if (!isRecord(details) || !isRecord(details.itemInfo) || !isRecord(details.itemInfo.itemStruct)) return null;
  const item = details.itemInfo.itemStruct;
  const expectedId = post.pathname.match(/\/(?:video|v)\/(\d+)/)?.[1];
  if (item.id !== expectedId || item.imagePost || !isRecord(item.video)) return null;
  const formats = Array.isArray(item.video.bitrateInfo) ? item.video.bitrateInfo : [];
  const candidates = formats.flatMap((format) => {
    if (!isRecord(format) || !isRecord(format.PlayAddr) || !Array.isArray(format.PlayAddr.UrlList)) return [];
    if (typeof format.CodecType === 'string' && !/^(?:h264|avc)/i.test(format.CodecType)) return [];
    return format.PlayAddr.UrlList.filter(isTikTokMediaUrl);
  });
  let videoUrl: string | undefined;
  for (const candidate of candidates) {
    if (!isTikTokDirectMediaHost(new URL(candidate).hostname)) continue;
    try {
      const probe = await requestPublicHttp(new URL(candidate), {
        range: 'bytes=0-0', cookie, referer: 'https://www.tiktok.com/', 'user-agent': TIKTOK_DIRECT_USER_AGENT,
      }, localContext, { streamBody: true });
      const contentType = probe.headers['content-type']?.toString().toLowerCase() ?? '';
      discardResponseBody(probe.body);
      if ((probe.status === 200 || probe.status === 206) && contentType.startsWith('video/')) {
        videoUrl = candidate;
        break;
      }
    } catch {
      if (localContext.signal.aborted) break;
    }
  }
  if (!videoUrl) return null;
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);
  sessions.set(videoUrl, { cookie, expires: Date.now() + SESSION_LIFETIME_MS });
  const author = isRecord(item.author) ? item.author : null;
  return { videoUrl, ...(author ? { author: {
    name: typeof author.nickname === 'string' ? normalizeExternalText(author.nickname) || null : null,
    username: typeof author.uniqueId === 'string' ? normalizeExternalText(author.uniqueId) || null : null,
    avatarUrl: isTikTokAvatarUrl(author.avatarThumb) ? author.avatarThumb : null,
  } } : {}) };
}

export function isTikTokDirectMediaHost(hostname: string): boolean {
  return /^v\d+-webapp(?:-prime)?\.tiktok\.com$/.test(hostname);
}

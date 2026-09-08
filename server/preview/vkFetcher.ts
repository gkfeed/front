import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { discardResponseBody, requestPublicHttp } from '../publicHttp.js';
import { isVkHost } from '../../shared/urlRules.js';
import { PreviewError } from './errors.js';
import { firstHeader } from './headers.js';
import { readHtmlBody } from './previewBodyReaders.js';
import { TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import { isRedirect, parsePublicHttpUrl, throwPublicUrlError } from './remoteHttp.js';
import { getVkChallengeAnswer } from './vkChallenge.js';

const MAX_REQUESTS = 12;
const MAX_CHALLENGES = 3;
const CLEARANCE_COOKIES = new Set(['hitw429', 'solution429', 's429']);

export async function fetchVkHtml(input: URL, context?: RequestExecutionContext): Promise<{
  html: string;
  url: URL;
}> {
  let url = input;
  let challenges = 0;
  // Public clearance only, isolated to this fetch and the exact issuing origin.
  const cookies = new Map<string, Map<string, string>>();
  for (let attempt = 0; attempt < MAX_REQUESTS; attempt += 1) {
    url = parsePublicHttpUrl(url.href);
    if (!isVkHost(url.hostname)) {
      throw new PreviewError('VK returned a redirect outside VK', 'invalid_redirect');
    }
    const jar = cookies.get(url.origin) ?? new Map<string, string>();
    cookies.set(url.origin, jar);
    const headers: Record<string, string> = {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': TWITTERBOT_USER_AGENT,
    };
    if (jar.size) headers.cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    const response = await requestPublicHttp(url, headers, context).catch((error: unknown) => {
      throwPublicUrlError(error);
      throw new PreviewError('The VK page could not be fetched', 'fetch_failed');
    });
    for (const cookie of response.headers['set-cookie'] ?? []) {
      const match = cookie.match(/^([^=;]+)=([^;]*)/);
      if (!match || !CLEARANCE_COOKIES.has(match[1]!)) continue;
      if (match[2] === 'deleted' || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) jar.delete(match[1]!);
      else jar.set(match[1]!, match[2]!);
    }
    if (isRedirect(response.status)) {
      discardResponseBody(response.body);
      const location = firstHeader(response.headers.location);
      if (!location) throw new PreviewError('VK returned an invalid redirect', 'invalid_redirect');
      try {
        url = new URL(location, url);
      } catch {
        throw new PreviewError('VK returned an invalid redirect', 'invalid_redirect');
      }
      continue;
    }
    if (response.status < 200 || response.status >= 300) {
      discardResponseBody(response.body);
      throw new PreviewError(`VK returned HTTP ${response.status}`, 'upstream_error');
    }
    const contentType = firstHeader(response.headers['content-type'])?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      discardResponseBody(response.body);
      throw new PreviewError('VK did not return an HTML page', 'not_html');
    }
    const encoding = contentType.match(/charset\s*=\s*["']?([^;\s"']+)/)?.[1];
    const html = await readHtmlBody(response, { encoding, context });
    if (url.pathname !== '/challenge.html') {
      const pageUrl = new URL(url);
      pageUrl.searchParams.delete('s429');
      return { html, url: pageUrl };
    }
    const answer = challenges < MAX_CHALLENGES ? getVkChallengeAnswer(html, url) : null;
    if (!answer) {
      throw new PreviewError('VK requires browser verification before this post can be previewed', 'upstream_challenge');
    }
    challenges += 1;
    url = answer;
  }
  throw new PreviewError('VK redirected too many times', 'too_many_redirects');
}

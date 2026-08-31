import { fetchHtmlResponse, TWITTERBOT_USER_AGENT } from './previewFetchers.js';
import { readHtmlBody, readMetadataBody } from './previewBodyReaders.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export async function fetchHtml(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  options: { metadataOnly?: boolean; maxBytes?: number; truncateAtLimit?: boolean } = {},
  context?: RequestExecutionContext,
): Promise<{ html: string; url: URL }> {
  const { response, contentType } = await fetchHtmlResponse(input, userAgent, context);
  const html = options.metadataOnly === true
    ? await readMetadataBody(response, getCharset(contentType), context)
    : await readHtmlBody(response, {
      encoding: getCharset(contentType),
      maxBytes: options.maxBytes,
      truncateAtLimit: options.truncateAtLimit,
      context,
    });
  return { html, url: response.url };
}

function getCharset(contentType: string): string | undefined {
  const match = contentType.match(/(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

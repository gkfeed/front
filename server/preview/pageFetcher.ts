import {
  fetchHtmlResponse,
  readHtmlBody,
  readMetadataBody,
  TWITTERBOT_USER_AGENT,
} from './previewFetchers.js';

export async function fetchHtml(
  input: URL,
  userAgent = TWITTERBOT_USER_AGENT,
  options: { metadataOnly?: boolean } = {},
): Promise<{ html: string; url: URL }> {
  const { response, contentType } = await fetchHtmlResponse(input, userAgent);
  const html = options.metadataOnly === true
    ? await readMetadataBody(response, getCharset(contentType))
    : await readHtmlBody(response, { encoding: getCharset(contentType) });
  return { html, url: response.url };
}

function getCharset(contentType: string): string | undefined {
  const match = contentType.match(/(?:^|;)\s*charset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

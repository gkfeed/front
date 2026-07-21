import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8_000;

export interface OpenGraphPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  type: string | null;
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
  let url = parsePublicHttpUrl(input);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    await assertPublicHost(url);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'GKFeed-Preview/1.0',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'TimeoutError'
        ? 'The remote page took too long to respond'
        : 'The remote page could not be fetched';
      throw new PreviewError(message, 502, 'fetch_failed');
    }

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new PreviewError('The remote page returned an invalid redirect', 502, 'invalid_redirect');
      if (redirects === MAX_REDIRECTS) throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
      url = parsePublicHttpUrl(new URL(location, url).href);
      continue;
    }

    if (!response.ok) {
      throw new PreviewError(`The remote page returned HTTP ${response.status}`, 502, 'upstream_error');
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new PreviewError('The URL does not point to an HTML page', 422, 'not_html');
    }

    const html = await readLimitedBody(response);
    return parseOpenGraph(html, url);
  }

  throw new PreviewError('The remote page redirected too many times', 502, 'too_many_redirects');
}

export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = attributes.content?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }

  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = metadata.get('og:image') ?? metadata.get('og:image:url');

  return {
    url: pageUrl.href,
    title: metadata.get('og:title') ?? (documentTitle ? decodeHtml(stripTags(documentTitle).trim()) : null),
    description: metadata.get('og:description') ?? metadata.get('description') ?? null,
    image: resolveHttpUrl(image, pageUrl),
    siteName: metadata.get('og:site_name') ?? null,
    type: metadata.get('og:type') ?? null,
  };
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

function resolveHttpUrl(value: string | undefined, base: URL): string | null {
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

async function assertPublicHost(url: URL): Promise<void> {
  let addresses: Array<{ address: string; family: number }>;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    addresses = [{ address: hostname, family: literalFamily }];
  } else {
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new PreviewError('The URL hostname could not be resolved', 422, 'unresolvable_host');
    }
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new PreviewError('Private or local network URLs are not allowed', 403, 'private_url');
  }
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }

  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('ff') || /^fe[89ab]/.test(normalized);
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

async function readLimitedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (declaredLength > MAX_RESPONSE_BYTES) throw responseTooLarge();
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw responseTooLarge();
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

function responseTooLarge(): PreviewError {
  return new PreviewError('The remote page is too large to preview', 422, 'response_too_large');
}

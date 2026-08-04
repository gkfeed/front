import { PreviewError } from './errors.js';

export function parsePublicHttpUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PreviewError('A valid URL is required', 'invalid_url');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new PreviewError('Only public HTTP and HTTPS URLs are allowed', 'invalid_url');
  }
  return url;
}

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

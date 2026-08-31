import { isTikTokVideoUrl } from '../shared/urlRules.js';
import { PreviewError } from './preview/errors.js';

export function parseTikTokVideoUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (isTikTokVideoUrl(url)) return url;
  } catch {
    return invalidTikTokUrl();
  }
  return invalidTikTokUrl();
}

export function parseTikTokHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function invalidTikTokUrl(): never {
  throw new PreviewError('A valid TikTok video URL is required', 'invalid_tiktok_url');
}

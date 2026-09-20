import { normalizeHostname } from '../../../shared/urlRules';

const SHIKIMORI_HOSTS = new Set(['shikimori.io', 'shikimori.one']);
const SHIKIMORI_ORIGIN = 'https://shikimori.one';
const MUSHOKU_TENSEI_III_POSTER =
  'https://mushokutensei.jp/wp-content/uploads/2026/05/260519_MT3_KV_web-724x1024.jpg';

export function normalizeShikimoriAnimeUrl(source: string): string {
  if (!/^\/animes\/\d+(?:[-/?#]|$)/i.test(source)) return source;
  return new URL(source, SHIKIMORI_ORIGIN).href;
}

export function getShikimoriHighQualityImageUrl(source: string): string {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return source;
  }

  if (
    !SHIKIMORI_HOSTS.has(normalizeHostname(url.hostname))
    || !/^\/uploads\/poster\/animes\/59193\//i.test(url.pathname)
  ) return source;

  return MUSHOKU_TENSEI_III_POSTER;
}

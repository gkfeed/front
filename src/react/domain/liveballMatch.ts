import { isLiveballMatchUrl } from '../../../shared/urlRules';
import type { FeedItem } from '../types';

export function parseLiveballMatch(item: FeedItem) {
  let url: URL;
  try { url = new URL(item.link); } catch { return null; }
  if (!isLiveballMatchUrl(url)) return null;
  const match = item.title.match(/^\s*(.+?)\s+vs\.?\s+(.+?)(?:\s+-\s+(.+))?\s*$/i);
  if (!match) return null;
  return { home: match[1].trim(), away: match[2].trim(), competition: match[3]?.trim() };
}

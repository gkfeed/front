import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { isRecord } from '../shared/valueGuards.js';
import type { YoutubeTimecode, YoutubeTimecodesPreview } from '../shared/youtubeContracts.js';
import { fetchYoutubeText, parseAssignedJson, parseYoutubeVideoId } from './youtubeComments.js';

const TIMECODE_LIMIT = 200;

export async function fetchYoutubeTimecodes(
  input: string,
  context?: RequestExecutionContext,
): Promise<YoutubeTimecodesPreview> {
  const videoId = parseYoutubeVideoId(input);
  const watchUrl = new URL('https://www.youtube.com/watch');
  watchUrl.searchParams.set('v', videoId);
  watchUrl.searchParams.set('hl', 'en');

  try {
    const html = await fetchYoutubeText(watchUrl, context);
    const playerResponse = parseAssignedJson(html, 'ytInitialPlayerResponse');
    const initialData = parseAssignedJson(html, 'ytInitialData');
    return { timecodes: parseYoutubeTimecodes([playerResponse, initialData]) };
  } catch (error) {
    if (error instanceof PreviewError) throw error;
    throw new PreviewError('YouTube timecodes could not be fetched', 'timecodes_fetch_failed');
  }
}

export function parseYoutubeTimecodes(value: unknown): YoutubeTimecode[] {
  const chapters = findAllByKey(value, 'chapterRenderer').flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const title = runsText(candidate.title);
    const milliseconds = numericValue(candidate.timeRangeStartMillis);
    if (!title || milliseconds === null || milliseconds < 0) return [];
    return [{
      title,
      seconds: Math.floor(milliseconds / 1000),
      thumbnailUrl: thumbnailUrl(candidate.thumbnail),
    }];
  });
  const markers = findAllByKey(value, 'macroMarkersListItemRenderer').flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const title = runsText(candidate.title);
    const seconds = parseDisplayedTime(runsText(candidate.timeDescription));
    return title && seconds !== null ? [{
      title,
      seconds,
      thumbnailUrl: thumbnailUrl(candidate.thumbnail),
    }] : [];
  });
  const unique = new Map<number, YoutubeTimecode>();
  [...chapters, ...markers].forEach((timecode) => {
    const existing = unique.get(timecode.seconds);
    if (!existing) unique.set(timecode.seconds, timecode);
    else if (!existing.thumbnailUrl && timecode.thumbnailUrl) {
      unique.set(timecode.seconds, { ...existing, thumbnailUrl: timecode.thumbnailUrl });
    }
  });
  return [...unique.values()]
    .sort((first, second) => first.seconds - second.seconds)
    .slice(0, TIMECODE_LIMIT);
}

function findAllByKey(value: unknown, key: string): unknown[] {
  const found: unknown[] = [];
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    Object.entries(candidate).forEach(([candidateKey, nested]) => {
      if (candidateKey === key) found.push(nested);
      visit(nested);
    });
  };
  visit(value);
  return found;
}

function runsText(value: unknown): string {
  if (!isRecord(value)) return '';
  if (typeof value.simpleText === 'string') return value.simpleText.trim();
  if (!Array.isArray(value.runs)) return '';
  return value.runs.map((run) => isRecord(run) && typeof run.text === 'string' ? run.text : '').join('').trim();
}

function numericValue(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function thumbnailUrl(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.thumbnails)) return null;
  const thumbnail = value.thumbnails.at(-1);
  if (!isRecord(thumbnail) || typeof thumbnail.url !== 'string') return null;
  return thumbnail.url.startsWith('//') ? `https:${thumbnail.url}` : thumbnail.url;
}

function parseDisplayedTime(value: string): number | null {
  if (!/^\d+(?::\d{1,2}){1,2}$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.some((part) => !Number.isInteger(part)) || parts.slice(1).some((part) => part >= 60)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

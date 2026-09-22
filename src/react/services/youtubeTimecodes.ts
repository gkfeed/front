import { requestBffJson } from './bffClient';
import {
  isYoutubeTimecodesPreview,
  type YoutubeTimecodesPreview,
} from '../../../shared/youtubeContracts';

export async function fetchYoutubeTimecodes(
  url: string,
  signal: AbortSignal,
): Promise<YoutubeTimecodesPreview> {
  return requestBffJson({
    endpoint: '/bff/youtube-timecodes',
    input: url,
    resourceName: 'YouTube timecodes',
    validate: isYoutubeTimecodesPreview,
    signal,
  });
}

export function formatYoutubeTimecode(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

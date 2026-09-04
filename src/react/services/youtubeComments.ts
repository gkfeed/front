import { requestBffJson } from './bffClient';
import {
  isYoutubeCommentsPreview,
  type YoutubeCommentsPreview,
} from '../../../shared/youtubeContracts';

export async function fetchYoutubeComments(
  url: string,
  signal: AbortSignal,
): Promise<YoutubeCommentsPreview> {
  return requestBffJson({
    endpoint: '/bff/youtube-comments',
    input: url,
    resourceName: 'YouTube comments',
    validate: isYoutubeCommentsPreview,
    signal,
  });
}

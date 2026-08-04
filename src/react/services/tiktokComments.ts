import { requestBffJson } from './bffClient';
import {
  isTikTokCommentsPreview,
  type TikTokCommentsPreview,
} from '../../../shared/tiktokContracts';

export type { TikTokComment, TikTokCommentsPreview } from '../../../shared/tiktokContracts';

export async function fetchTikTokComments(
  url: string,
  signal: AbortSignal,
): Promise<TikTokCommentsPreview> {
  return requestBffJson({
    endpoint: '/api/bff/tiktok-comments',
    input: url,
    resourceName: 'TikTok comments',
    validate: isTikTokCommentsPreview,
    signal,
  });
}

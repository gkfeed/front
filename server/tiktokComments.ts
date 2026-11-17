import type { RequestExecutionContext } from './application/requestExecutionContext.js';
import { PreviewError } from './preview/errors.js';
import { PublicHttpError } from './publicHttpError.js';
import { emptyTikTokDetails } from './tiktokDetailsParser.js';
import { fetchTikTokWebComments, fetchTikTokWebDetails } from './tiktokWebComments.js';
import { parseTikTokVideoUrl } from './tiktokUrlParser.js';
import type { TikTokComment, TikTokCommentsPreview } from '../shared/tiktokContracts.js';

export async function fetchTikTokComments(
  input: string,
  context?: RequestExecutionContext,
): Promise<TikTokCommentsPreview> {
  const post = parseTikTokVideoUrl(input);
  const [comments, details] = await Promise.all([
    fetchComments(post, context),
    fetchTikTokWebDetails(post, context).catch(() => null),
  ]);
  if (context?.signal.aborted) throw new PreviewError('TikTok comments request aborted', 'comments_fetch_failed');
  return { comments, ...(details ?? emptyTikTokDetails()) };
}

async function fetchComments(post: URL, context?: RequestExecutionContext): Promise<TikTokComment[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (context?.signal.aborted) throw new PreviewError('TikTok comments request aborted', 'comments_fetch_failed');
    try {
      const comments = await fetchTikTokWebComments(post, context);
      if (comments !== null) return comments;
      if (attempt === 1) throw new PreviewError('TikTok did not return comments', 'comments_upstream_error');
    } catch (error) {
      const transient = error instanceof PublicHttpError && ['network', 'timeout'].includes(error.reason);
      if (attempt === 0 && transient && !context?.signal.aborted) continue;
      if (error instanceof PreviewError) throw error;
      throw new PreviewError('TikTok comments could not be fetched', 'comments_fetch_failed');
    }
  }
  throw new PreviewError('TikTok comments could not be fetched', 'comments_fetch_failed');
}

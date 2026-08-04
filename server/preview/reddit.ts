import { PreviewError } from './errors.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchImageResponse, readImageBody } from './previewFetchers.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export async function fetchRedditPreviewImage(input: string, context?: RequestExecutionContext): Promise<PreviewImage> {
  const url = parsePublicHttpUrl(input);
  if (url.hostname.toLowerCase() !== 'share.redd.it' || !url.pathname.startsWith('/preview/post/')) {
    throw new PreviewError('Only Reddit preview images can be proxied', 'invalid_reddit_preview');
  }

  const { response, contentType } = await fetchImageResponse(url, context);
  return { body: await readImageBody(response, context), contentType };
}

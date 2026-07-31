import { PreviewError } from './errors.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import { fetchImageResponse, readImageBody } from './previewFetchers.js';

export interface PreviewImage {
  body: Uint8Array;
  contentType: string;
}

export async function fetchRedditPreviewImage(input: string): Promise<PreviewImage> {
  const url = parsePublicHttpUrl(input);
  if (url.hostname.toLowerCase() !== 'share.redd.it' || !url.pathname.startsWith('/preview/post/')) {
    throw new PreviewError('Only Reddit preview images can be proxied', 400, 'invalid_reddit_preview');
  }

  const { response, contentType } = await fetchImageResponse(url);
  return { body: await readImageBody(response), contentType };
}

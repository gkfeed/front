import { PreviewError } from '../preview/errors.js';

export function getRequiredPreviewUrl(requestUrl: URL): string {
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) {
    throw new PreviewError('The url query parameter is required', 'missing_url');
  }
  return targetUrl;
}

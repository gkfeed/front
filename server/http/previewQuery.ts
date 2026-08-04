import { HttpRequestError } from './httpErrors.js';

export function getRequiredPreviewUrl(requestUrl: URL): string {
  const targetUrl = requestUrl.searchParams.get('url');
  if (!targetUrl) {
    throw new HttpRequestError('The url query parameter is required', 'missing_url', 400);
  }
  return targetUrl;
}

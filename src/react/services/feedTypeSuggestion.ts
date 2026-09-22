import {
  isFeedTypeSuggestion,
  type FeedTypeSuggestion,
} from '../../../shared/feedTypeSuggestion';
import { BffHttpError, BffResponseError, BffTimeoutError } from './bffClient';
import { requestJson } from './httpRequest';

const ENDPOINT = '/bff/feed-type';

export async function getFeedTypeSuggestion(
  url: string,
  title: string,
  signal?: AbortSignal,
): Promise<FeedTypeSuggestion> {
  const search = new URLSearchParams({ url });
  if (title.trim()) search.set('title', title.trim());
  return requestJson(`${ENDPOINT}?${search}`, { signal }, {
    timeoutMs: 7_000,
    createHttpError: (status) => new BffHttpError(
      `Feed type request failed with ${status}`,
      status,
      ENDPOINT,
    ),
    createTimeoutError: (timeoutMs) => new BffTimeoutError(ENDPOINT, timeoutMs),
    createInvalidJsonError: (status) => new BffResponseError(
      'Invalid feed type response',
      ENDPOINT,
      status,
      'invalid-json',
    ),
    validate: isFeedTypeSuggestion,
    createInvalidResponseError: (status) => new BffResponseError(
      'Invalid feed type response',
      ENDPOINT,
      status,
    ),
  });
}

import type { Credentials } from '../types';
import { authorization, endpoint, requestJson } from './apiClient';
import { parseFeeds } from './feedSchemas';

/** The API has no auth endpoint, so validation uses the protected feed route. */
export async function validateCredentials(
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<void> {
  const response = await requestJson(endpoint('list'), {
    headers: authorization(credentials),
    ...(signal ? { signal } : {}),
  });
  parseFeeds(response);
}

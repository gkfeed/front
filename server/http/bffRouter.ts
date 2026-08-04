import type { ServerResponse } from 'node:http';

import { isTikTokCommentsPreview } from '../../shared/tiktokContracts.js';
import { sendJson } from './httpResponse.js';
import type { PreviewUseCases } from '../application/previewUseCases.js';
import {
  createDetachedRequestExecutionContext,
  type RequestExecutionContext,
} from '../application/requestExecutionContext.js';
import { getRequiredPreviewUrl } from './previewQuery.js';
import { sendPreviewImage } from './previewResponse.js';

type JsonPreviewUseCaseName = keyof Pick<PreviewUseCases, 'openGraph' | 'liquipediaMatch' | 'tiktokComments'>;

const JSON_PREVIEW_ROUTES: Record<string, JsonPreviewUseCaseName> = {
  '/api/bff/open-graph': 'openGraph',
  '/api/bff/liquipedia-match': 'liquipediaMatch',
  '/api/bff/tiktok-comments': 'tiktokComments',
};

export async function routeBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context: RequestExecutionContext | undefined,
  useCases: PreviewUseCases,
): Promise<boolean> {
  const requestContext = context ?? createDetachedRequestExecutionContext();
  const useCaseName = JSON_PREVIEW_ROUTES[requestUrl.pathname];
  if (useCaseName) {
    await handleJsonPreview(
      requestUrl,
      response,
      (input, context) => useCases[useCaseName](input, context),
      requestContext,
      useCaseName === 'tiktokComments' ? isTikTokCommentsPreview : undefined,
    );
    return true;
  }

  if (requestUrl.pathname === '/api/bff/reddit-preview-image') {
    const image = await useCases.redditPreviewImage(getRequiredPreviewUrl(requestUrl), requestContext);
    sendPreviewImage(response, image);
    return true;
  }

  return false;
}

async function handleJsonPreview(
  requestUrl: URL,
  response: ServerResponse,
  load: (input: string, context: RequestExecutionContext) => Promise<unknown>,
  context: RequestExecutionContext,
  validate?: (value: unknown) => boolean,
): Promise<void> {
  const result = await load(getRequiredPreviewUrl(requestUrl), context);
  if (validate && !validate(result)) throw new Error('Invalid TikTok comments contract');
  sendJson(response, 200, result);
}

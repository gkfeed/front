import type { ServerResponse } from 'node:http';

import type { PreviewUseCases } from './application/previewUseCases.js';
import { routeBffRequest } from './http/bffRouter.js';
import type { RequestContext } from './requestContext.js';
import { previewUseCases } from './transport/previewAdapters.js';

export function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context?: RequestContext,
  useCases: PreviewUseCases = previewUseCases,
): Promise<boolean> {
  return routeBffRequest(requestUrl, response, context, useCases);
}

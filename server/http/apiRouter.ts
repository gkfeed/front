import type { ServerResponse } from 'node:http';

import type { PreviewUseCases } from '../application/previewUseCases.js';
import { previewUseCases } from '../compositionRoot.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { routeBffRequest } from './bffRouter.js';
import { bffRequestGate, type BffRequestGate } from './bffRequestGate.js';
import { bffResultCache, type BffResultCache } from './bffResultCache.js';

export function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context?: RequestExecutionContext,
  useCases: PreviewUseCases = previewUseCases,
  clientId = 'detached',
  requestGate: BffRequestGate = bffRequestGate,
  resultCache: BffResultCache = bffResultCache,
): Promise<boolean> {
  return routeBffRequest(requestUrl, response, context, useCases, clientId, requestGate, resultCache);
}

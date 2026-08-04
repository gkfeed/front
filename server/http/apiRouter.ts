import type { ServerResponse } from 'node:http';

import type { PreviewUseCases } from '../application/previewUseCases.js';
import { previewUseCases } from '../compositionRoot.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { routeBffRequest } from './bffRouter.js';

export function handleBffRequest(
  requestUrl: URL,
  response: ServerResponse,
  context?: RequestExecutionContext,
  useCases: PreviewUseCases = previewUseCases,
): Promise<boolean> {
  return routeBffRequest(requestUrl, response, context, useCases);
}

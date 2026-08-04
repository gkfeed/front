import { createPreviewUseCases } from './application/previewUseCaseFactory.js';
import type { PreviewUseCases } from './application/previewUseCases.js';
import { withPreviewLimit } from './preview/previewLimiter.js';
import { previewProviderPorts } from './transport/previewAdapters.js';

/**
 * The only place where application use cases are wired to infrastructure.
 * HTTP transport receives the resulting application contract through apiRouter.
 */
export const previewUseCases: PreviewUseCases = createPreviewUseCases(
  previewProviderPorts,
  withPreviewLimit,
);

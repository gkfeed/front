import { createPreviewUseCases } from './application/previewUseCaseFactory.js';
import type { PreviewUseCases } from './application/previewUseCases.js';
import type {
  PreviewConcurrencyLimiter,
  PreviewPorts,
} from './application/previewPorts.js';
import { withPreviewLimit } from './preview/previewLimiter.js';
import { previewProviderPorts } from './transport/previewAdapters.js';

export interface PreviewCompositionOptions {
  ports?: PreviewPorts;
  limit?: PreviewConcurrencyLimiter;
}

export function createPreviewComposition({
  ports = previewProviderPorts,
  limit = withPreviewLimit,
}: PreviewCompositionOptions = {}): PreviewUseCases {
  return createPreviewUseCases(ports, limit);
}

/**
 * The only place where application use cases are wired to infrastructure.
 * HTTP transport receives the resulting application contract through apiRouter.
 */
export const previewUseCases: PreviewUseCases = createPreviewComposition();

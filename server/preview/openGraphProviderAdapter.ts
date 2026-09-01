import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';

export interface OpenGraphProviderAdapter {
  matches(url: URL): boolean;
  fetch(url: URL, context?: RequestExecutionContext): Promise<OpenGraphPreview>;
  parse(html: string, pageUrl: URL): OpenGraphPreview;
}

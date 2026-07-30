import { isOpenGraphPreview } from '../../../shared/previewGuards';
import type { OpenGraphPreview } from '../../../shared/previewContracts';
import { isVkImageHost } from '../../../shared/urlRules';

export type { OpenGraphPreview } from '../../../shared/previewContracts';

export async function getOpenGraphPreview(url: string, signal?: AbortSignal): Promise<OpenGraphPreview> {
  const response = await fetch(`/api/bff/open-graph?url=${encodeURIComponent(url)}`, { signal });
  if (!response.ok) throw new Error(`Preview request failed with ${response.status}`);

  const value: unknown = await response.json();
  if (!isOpenGraphPreview(value)) throw new Error('Invalid preview response');
  return {
    ...value,
    image: value.image ? getBrowserImageUrl(value.image) : null,
  };
}

function getBrowserImageUrl(imageUrl: string): string {
  try {
    const url = new URL(imageUrl);
    if (url.hostname.toLowerCase() === 'share.redd.it' && url.pathname.startsWith('/preview/post/')) {
      return `/api/bff/reddit-preview-image?url=${encodeURIComponent(url.href)}`;
    }
    if (url.protocol === 'http:' && url.hostname.toLowerCase() === 'api.url2png.com') {
      url.protocol = 'https:';
      return url.href;
    }
    if (url.protocol === 'http:' && isVkImageHost(url.hostname)) {
      url.protocol = 'https:';
      return url.href;
    }
  } catch {
    return imageUrl;
  }
  return imageUrl;
}

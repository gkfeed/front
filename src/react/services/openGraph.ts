import { isOpenGraphPreview } from '../../../shared/previewGuards';
import type { OpenGraphPreview } from '../../../shared/previewContracts';
import { isVkImageHost } from '../../../shared/urlRules';
import { getShikimoriHighQualityImageUrl } from '../domain/shikimoriPreview';
import { requestBffJson } from './bffClient';

export type {
  HltvMatchSnapshot,
  OpenGraphMetadata,
  OpenGraphPreview,
} from '../../../shared/previewContracts';

export async function getOpenGraphPreview(url: string, signal?: AbortSignal): Promise<OpenGraphPreview> {
  const value = await requestBffJson({
    endpoint: '/bff/open-graph',
    input: url,
    resourceName: 'preview',
    httpErrorName: 'Preview',
    validate: isOpenGraphPreview,
    signal,
  });
  return {
    ...value,
    image: value.image ? getBrowserImageUrl(value.image) : null,
  };
}

function getBrowserImageUrl(imageUrl: string): string {
  const highQualityImageUrl = getShikimoriHighQualityImageUrl(imageUrl);
  if (highQualityImageUrl !== imageUrl) return highQualityImageUrl;

  try {
    const url = new URL(imageUrl);
    if (url.hostname.toLowerCase() === 'share.redd.it' && url.pathname.startsWith('/preview/post/')) {
      return `/bff/reddit-preview-image?url=${encodeURIComponent(url.href)}`;
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

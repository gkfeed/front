import { getObjectProperty } from '../unknownObject';

export interface OpenGraphPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  video: string | null;
  siteName: string | null;
  type: string | null;
}

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
  } catch {
    return imageUrl;
  }
  return imageUrl;
}

function isOpenGraphPreview(value: unknown): value is OpenGraphPreview {
  const url = getObjectProperty(value, 'url');
  const title = getObjectProperty(value, 'title');
  const description = getObjectProperty(value, 'description');
  const image = getObjectProperty(value, 'image');
  const video = getObjectProperty(value, 'video');
  const siteName = getObjectProperty(value, 'siteName');
  const type = getObjectProperty(value, 'type');

  return typeof url === 'string'
    && [title, description, image, video, siteName, type].every(isNullableString);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

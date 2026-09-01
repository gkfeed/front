import type { OpenGraphPreview } from '../../shared/previewContracts.js';
import { decodeHtml, parseAttributes, resolveHttpUrl, stripTags } from './html.js';

export function parseOpenGraph(html: string, pageUrl: URL): OpenGraphPreview {
  const metadata = parseMetadata(html);
  const documentTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const image = firstMetadata(metadata, [
    'og:image',
    'og:image:secure_url',
    'og:image:url',
    'twitter:image',
    'twitter:image:src',
  ]);
  const video = firstMetadata(metadata, [
    'og:video:secure_url',
    'og:video',
    'og:video:url',
    'twitter:player:stream',
  ]);

  return {
    url: pageUrl.href,
    title: firstMetadata(metadata, ['og:title', 'twitter:title'])
      ?? (documentTitle ? decodeHtml(stripTags(documentTitle).trim()) : null),
    description: firstMetadata(metadata, ['og:description', 'twitter:description', 'description']),
    image: resolveHttpUrl(image, pageUrl),
    video: resolveHttpUrl(video, pageUrl),
    siteName: metadata.get('og:site_name') ?? null,
    type: metadata.get('og:type') ?? null,
    providerData: null,
  };
}

function parseMetadata(html: string): Map<string, string> {
  const metadata = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.property ?? attributes.name)?.toLowerCase();
    const value = (attributes.content ?? attributes.value)?.trim();
    if (key && value && !metadata.has(key)) metadata.set(key, decodeHtml(value));
  }
  return metadata;
}

function firstMetadata(metadata: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata.get(key);
    if (value) return value;
  }
  return null;
}

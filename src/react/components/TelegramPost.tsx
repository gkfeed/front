import { createElement, type ReactNode } from 'react';
import type { FeedItem } from '../types';
import { VkImageCarousel } from './previews/VkImageCarousel';

export function isTelegramPost(link: string): boolean {
  try {
    const url = new URL(link);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && url.hostname.toLowerCase() === 't.me' && !url.username && !url.password && !url.port
      && /^\/[a-z0-9_]+\/\d+\/?$/i.test(url.pathname);
  } catch { return false; }
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const allowed = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre', 'blockquote']);
function renderNode(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (!(node instanceof Element)) return null;
  const tag = node.tagName.toLowerCase();
  if (['script', 'style', 'iframe', 'object', 'svg', 'template'].includes(tag)) return null;
  const children = Array.from(node.childNodes, renderNode);
  if (tag === 'img') return null;
  if (tag === 'a') {
    const href = safeUrl(node.getAttribute('href'));
    return href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : children;
  }
  if (allowed.has(tag)) return createElement(tag, { key }, tag === 'br' ? undefined : children);
  return children;
}

export function TelegramPost({ item }: { item: FeedItem }) {
  const document = typeof DOMParser === 'undefined' ? null : new DOMParser().parseFromString(item.text || '', 'text/html');
  document?.querySelectorAll('script, style, iframe, object, svg, template').forEach((node) => node.remove());
  const images = Array.from(document?.querySelectorAll('img') ?? [])
    .map((image) => safeUrl(image.getAttribute('src')))
    .filter((src): src is string => src !== null);
  const content = Array.from(document?.body.childNodes ?? [], renderNode);
  const hasText = Boolean(document?.body.textContent?.trim());
  const channel = new URL(item.link).pathname.split('/')[1];
  return <>
    {images.length > 0 ? <VkImageCarousel key={item.link} href={item.link} hostname="Telegram"
      preview={{ src: images[0], imageUrls: images, alt: item.title || 'Telegram' }} onPreviewError={() => {}} /> : null}
    {hasText ? <div className="reader-card__copy telegram-post">
      <div className="telegram-post__content">{content}</div>
    </div> : null}
    {!hasText && images.length === 0 ? <a href={item.link} target="_blank" rel="noopener noreferrer">Telegram ↗</a> : null}
    <a className="telegram-post__channel" href={`https://t.me/${channel}`} target="_blank" rel="noopener noreferrer">@{channel}</a>
  </>;
}

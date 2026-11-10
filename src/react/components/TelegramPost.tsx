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

export function TelegramPost({ item, sourceTitle }: { item: FeedItem; sourceTitle?: string }) {
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
    <div className="reader-card__copy telegram-post">
      {hasText ? <div className="telegram-post__content">{content}</div> : null}
      {!hasText && images.length === 0 ? <a href={item.link} target="_blank" rel="noopener noreferrer">Telegram ↗</a> : null}
      <a className="telegram-post__channel" href={`https://t.me/${channel}`} target="_blank" rel="noopener noreferrer">
        <svg className="telegram-post__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="12" fill="#2aabee" /><path d="M5 11.6 18.1 6.5c.6-.2 1.1.2.9 1l-2.2 10.3c-.2.7-.6.9-1.2.6l-3.4-2.5-1.6 1.6c-.2.2-.3.3-.6.3l.2-3.5 6.3-5.7c.3-.2-.1-.4-.4-.2l-7.8 4.9-3.4-1.1c-.7-.2-.7-.5.1-.8Z" fill="#fff" /></svg>
        <span>{sourceTitle?.trim() || `@${channel}`}</span>
      </a>
    </div>
  </>;
}

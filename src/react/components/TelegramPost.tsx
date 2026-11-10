import { createElement, type ReactNode } from 'react';
import type { FeedItem } from '../types';

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
  if (tag === 'img') {
    const src = safeUrl(node.getAttribute('src'));
    return src ? <img key={key} src={src} alt={node.getAttribute('alt') || ''} loading="lazy" /> : null;
  }
  if (tag === 'a') {
    const href = safeUrl(node.getAttribute('href'));
    return href ? <a key={key} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : children;
  }
  if (allowed.has(tag)) return createElement(tag, { key }, tag === 'br' ? undefined : children);
  return children;
}

export function TelegramPost({ item }: { item: FeedItem }) {
  const content = typeof DOMParser === 'undefined' ? [] : Array.from(
    new DOMParser().parseFromString(item.text || '', 'text/html').body.childNodes, renderNode,
  );
  return <div className="reader-card__copy telegram-post">
    <h2 className="reader-card__title">{item.title || 'Telegram'}</h2>
    <div className="telegram-post__content">{content}</div>
    <a href={item.link} target="_blank" rel="noopener noreferrer">Telegram ↗</a>
  </div>;
}

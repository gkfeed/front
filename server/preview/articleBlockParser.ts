import { parseHTML } from 'linkedom';

import type { ArticleBlock } from '../../shared/articleContracts.js';
import { resolveHttpUrl } from './html.js';

const MAX_BLOCKS = 250;
const MAX_TEXT_LENGTH = 120_000;

export function extractBlocks(content: string, baseUrl: URL): ArticleBlock[] {
  const { document } = parseHTML(`<html><body>${content}</body></html>`);
  // Provider widgets are often bootstrapped by scripts embedded directly in a
  // paragraph. Their source is part of `textContent`, even though browsers do
  // not render it as article copy.
  Array.from(document.querySelectorAll('script, style, template')).forEach((element) => element.remove());
  const blocks: ArticleBlock[] = [];
  let textLength = 0;

  const add = (block: ArticleBlock, length = 'text' in block ? block.text.length : 0) => {
    if (blocks.length >= MAX_BLOCKS || textLength + length > MAX_TEXT_LENGTH) return;
    blocks.push(block);
    textLength += length;
  };

  const visit = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const text = cleanArticleText(element.textContent ?? '');
      if (text) add({ type: 'heading', text, level: Number(tag.slice(1)) });
      return;
    }
    if (tag === 'p' || tag === 'blockquote') {
      const text = cleanArticleText(element.textContent ?? '');
      if (text) add({ type: tag === 'p' ? 'paragraph' : 'quote', text });
      Array.from(element.querySelectorAll('img')).forEach(visit);
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .map((child) => cleanArticleText(child.textContent ?? ''))
        .filter(Boolean);
      if (items.length > 0) add({ type: 'list', items, ordered: tag === 'ol' }, items.join('').length);
      return;
    }
    if (tag === 'img') {
      const src = safeImageUrl(element.getAttribute('src') ?? element.getAttribute('data-src'), baseUrl);
      if (src) add({ type: 'image', src, alt: cleanArticleText(element.getAttribute('alt') ?? '') });
      return;
    }
    Array.from(element.children).forEach(visit);
  };

  Array.from(document.body.children).forEach(visit);
  return blocks;
}

export function nullableArticleText(value: string | null | undefined): string | null {
  const text = cleanArticleText(value ?? '');
  return text || null;
}

export function cleanArticleText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function safeImageUrl(value: string | null, baseUrl: URL): string | null {
  if (!value || value.startsWith('data:')) return null;
  return resolveHttpUrl(value, baseUrl);
}

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import type { ArticleBlock, ArticlePreview } from '../../shared/articleContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from './errors.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';

const MAX_BLOCKS = 250;
const MAX_TEXT_LENGTH = 120_000;
const ARTICLE_USER_AGENT = 'Mozilla/5.0 (compatible; GKFeedReader/1.0)';

export async function fetchArticle(
  input: string,
  context: RequestExecutionContext,
): Promise<ArticlePreview> {
  const requestedUrl = parsePublicHttpUrl(input);
  const { html, url } = await fetchHtml(requestedUrl, ARTICLE_USER_AGENT, {}, context);
  const { document } = parseHTML(html);
  // Trashbox exposes the editorial body explicitly. Keep it before Readability
  // mutates the document; this also preserves inline article images.
  const providerContent = document.querySelector('[id^="div_text_content_"]')?.innerHTML;
  const parsed = new Readability(document as unknown as Document, {
    charThreshold: 120,
  }).parse();

  if (!parsed?.content || !parsed.title) {
    throw new PreviewError('Readable article content was not found', 'article_not_found');
  }

  const blocks = extractBlocks(providerContent || parsed.content, url);
  const textLength = blocks.reduce((length, block) => (
    length + ('text' in block ? block.text.length : block.type === 'list'
      ? block.items.join('').length
      : 0)
  ), 0);
  if (blocks.length === 0 || textLength < 80) {
    throw new PreviewError('Readable article content was not found', 'article_not_found');
  }

  return {
    url: url.href,
    title: cleanText(parsed.title),
    byline: nullableText(parsed.byline),
    excerpt: nullableText(parsed.excerpt),
    blocks,
  };
}

export function extractBlocks(content: string, baseUrl: URL): ArticleBlock[] {
  const { document } = parseHTML(`<html><body>${content}</body></html>`);
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
      const text = cleanText(element.textContent ?? '');
      if (text) add({ type: 'heading', text, level: Number(tag.slice(1)) });
      return;
    }
    if (tag === 'p' || tag === 'blockquote') {
      const text = cleanText(element.textContent ?? '');
      if (text) add({ type: tag === 'p' ? 'paragraph' : 'quote', text });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items = Array.from(element.children)
        .filter((child) => child.tagName.toLowerCase() === 'li')
        .map((child) => cleanText(child.textContent ?? ''))
        .filter(Boolean);
      if (items.length > 0) add({ type: 'list', items, ordered: tag === 'ol' }, items.join('').length);
      return;
    }
    if (tag === 'img') {
      const src = safeImageUrl(element.getAttribute('src') ?? element.getAttribute('data-src'), baseUrl);
      if (src) add({ type: 'image', src, alt: cleanText(element.getAttribute('alt') ?? '') });
      return;
    }
    Array.from(element.children).forEach(visit);
  };

  Array.from(document.body.children).forEach(visit);
  return blocks;
}

function safeImageUrl(value: string | null, baseUrl: URL): string | null {
  if (!value || value.startsWith('data:')) return null;
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function nullableText(value: string | null | undefined): string | null {
  const text = cleanText(value ?? '');
  return text || null;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

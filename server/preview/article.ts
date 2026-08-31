import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import type { ArticlePreview } from '../../shared/articleContracts.js';
import type { RequestExecutionContext } from '../application/requestExecutionContext.js';
import { PreviewError } from './errors.js';
import { fetchHtml } from './pageFetcher.js';
import { parsePublicHttpUrl } from './publicUrlPolicy.js';
import {
  cleanArticleText,
  extractBlocks,
  nullableArticleText,
} from './articleBlockParser.js';

const ARTICLE_USER_AGENT = 'Mozilla/5.0 (compatible; GKFeedReader/1.0)';

export { extractBlocks } from './articleBlockParser.js';

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
    title: cleanArticleText(parsed.title),
    byline: nullableArticleText(parsed.byline),
    excerpt: nullableArticleText(parsed.excerpt),
    blocks,
  };
}

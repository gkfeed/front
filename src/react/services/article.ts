import { isArticlePreview, isArticleSummary, type ArticlePreview, type ArticleSummary } from '../../../shared/articleContracts';
import { requestBffJson } from './bffClient';

export type { ArticleBlock, ArticlePreview } from '../../../shared/articleContracts';

export function getArticle(url: string, signal?: AbortSignal): Promise<ArticlePreview> {
  return requestBffJson({
    endpoint: '/bff/article',
    input: url,
    resourceName: 'article',
    httpErrorName: 'Article',
    validate: isArticlePreview,
    signal,
    timeoutMs: 20_000,
  });
}

export function getArticleSummary(url: string, signal?: AbortSignal): Promise<ArticleSummary> {
  return requestBffJson({
    endpoint: '/bff/article-summary',
    input: url,
    resourceName: 'article summary',
    validate: isArticleSummary,
    signal,
    timeoutMs: 35_000,
  });
}

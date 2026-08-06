import { isArticlePreview, type ArticlePreview } from '../../../shared/articleContracts';
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

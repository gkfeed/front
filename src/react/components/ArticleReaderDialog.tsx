import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArticlePreview } from '../../../shared/articleContracts';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useFeatureUseCases } from '../state/useFeatureUseCases';
import { BffHttpError } from '../services/bffClient';
import { trapFocus } from '../platform/focusTrap';
import { ArticleContent } from './ArticleReaderContent';

export function ArticleReaderDialog({
  article,
  status,
  originalUrl,
  onClose,
  onRetry,
}: {
  article: ArticlePreview | undefined;
  status: 'idle' | 'loading' | 'success' | 'error';
  originalUrl: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const { preview } = useFeatureUseCases();
  const [summaryUrl, setSummaryUrl] = useState<string | null>(null);
  const loadSummary = useCallback((signal: AbortSignal) => (
    preview.loadArticleSummary(originalUrl, signal)
  ), [preview, originalUrl]);
  const summary = useAsyncResource(loadSummary, {
    enabled: Boolean(article) && summaryUrl === originalUrl,
    key: originalUrl,
    timeoutMs: 35_000,
  });
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const returnFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className="article-reader"
      role="dialog"
      aria-modal="true"
      aria-label={t('article.title')}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        trapFocus(event, dialogRef.current, { fallback: null });
      }}
    >
      <button
        className="article-reader__backdrop"
        type="button"
        tabIndex={-1}
        aria-label={t('article.close')}
        onClick={onClose}
      />
      <section className="article-reader__sheet">
        <header className="article-reader__toolbar">
          <button ref={closeRef} className="article-reader__close" type="button" onClick={onClose}>
            <span aria-hidden="true">←</span> {t('article.close')}
          </button>
          <button
            className="article-reader__summary-button"
            type="button"
            disabled={!article || status !== 'success' || summary.isLoading || summary.status === 'success'}
            onClick={() => {
              if (summary.status === 'error') summary.retry();
              else setSummaryUrl(originalUrl);
            }}
          >
            {t(summary.isLoading ? 'article.summarizing' : 'article.summarize')}
          </button>
          <a href={article?.url ?? originalUrl} target="_blank" rel="noreferrer">
            {t('article.original')} <span aria-hidden="true">↗</span>
          </a>
        </header>
        <div className="article-reader__content">
          {status === 'loading' || status === 'idle' ? (
            <p className="article-reader__status" role="status">{t('article.loading')}</p>
          ) : null}
          {status === 'error' ? (
            <div className="article-reader__status" role="alert">
              <p>{t('article.error')}</p>
              <button type="button" onClick={onRetry}>{t('article.retry')}</button>
            </div>
          ) : null}
          {summary.status !== 'idle' ? (
            <section className="article-reader__summary" aria-label={t('article.summaryTitle')} aria-busy={summary.isLoading}>
              <h2>{t('article.summaryTitle')}</h2>
              {summary.isLoading ? <p role="status">{t('article.summarizing')}</p> : null}
              {summary.result ? <p lang="ru" role="status">{summary.result.summary}</p> : null}
              {summary.status === 'error' ? <div role="alert">
                <p>{t(summary.error instanceof BffHttpError && summary.error.status === 503
                  ? 'article.summaryUnavailable' : 'article.summaryError')}</p>
                <button type="button" onClick={summary.retry}>{t('article.retry')}</button>
              </div> : null}
            </section>
          ) : null}
          {article ? <ArticleContent article={article} /> : null}
        </div>
      </section>
    </div>
  );
}

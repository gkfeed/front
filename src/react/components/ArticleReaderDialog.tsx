import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArticlePreview } from '../../../shared/articleContracts';
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
          {article ? <ArticleContent article={article} /> : null}
        </div>
      </section>
    </div>
  );
}

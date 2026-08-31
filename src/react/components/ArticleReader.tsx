import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import type { ArticleBlock, ArticlePreview } from '../../../shared/articleContracts';
import { trapFocus } from '../platform/focusTrap';
import { getFullscreenElement } from '../platform/readerFullscreen';
import type { useArticleReader } from '../hooks/useArticleReader';

type ArticleReaderState = ReturnType<typeof useArticleReader>;

export function ArticleReaderLink({
  url,
  enabled,
  onOpen,
}: {
  url: string;
  enabled: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  if (!enabled) {
    return (
      <a className="reader-card__link" href={url} target="_blank" rel="noreferrer">
        {t('reader.openOriginal')} <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <>
      <a
        className="reader-card__link"
        href={url}
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
      >
        {t('reader.openOriginal')} <span aria-hidden="true">↗</span>
      </a>
    </>
  );
}

export function ArticleReaderOverlay({ reader, originalUrl }: {
  reader: ArticleReaderState;
  originalUrl: string;
}) {
  if (!reader.isOpen) return null;
  // Native fullscreen only paints the fullscreen element and its descendants.
  // Portaling to body would mount the dialog successfully but keep it invisible.
  const portalRoot = getFullscreenElement() ?? document.body;
  return createPortal(
    <ArticleReaderDialog
      article={reader.result}
      status={reader.status}
      originalUrl={originalUrl}
      onClose={reader.close}
      onRetry={reader.retry}
    />,
    portalRoot,
  );
}

function ArticleReaderDialog({
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

function ArticleContent({ article }: { article: ArticlePreview }) {
  return (
    <article className="article-reader__article">
      <h1>{article.title}</h1>
      {article.byline ? <p className="article-reader__byline">{article.byline}</p> : null}
      {article.blocks.map((block, index) => <ArticleBlockView key={`${block.type}-${index}`} block={block} />)}
    </article>
  );
}

function ArticleBlockView({ block }: { block: ArticleBlock }) {
  if (block.type === 'paragraph') return <p>{block.text}</p>;
  if (block.type === 'quote') return <blockquote>{block.text}</blockquote>;
  if (block.type === 'image') {
    return <img src={block.src} alt={block.alt} loading="lazy" referrerPolicy="no-referrer" />;
  }
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return <List>{block.items.map((item, index) => <li key={index}>{item}</li>)}</List>;
  }
  if (block.type !== 'heading') return null;
  const level = Math.min(6, Math.max(2, block.level + 1));
  const Heading = `h${level}` as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return <Heading>{block.text}</Heading>;
}

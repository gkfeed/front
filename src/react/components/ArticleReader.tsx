import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { getFullscreenElement } from '../platform/readerFullscreen';
import type { useArticleReader } from '../hooks/useArticleReader';
import { ArticleReaderDialog } from './ArticleReaderDialog';

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

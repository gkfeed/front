import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ReaderReview } from '../components/ReaderReview';
import { ReaderScroll } from '../components/ReaderScroll';
import { ReaderFullscreenButton } from '../components/ReaderFullscreenButton';
import { useFeedReader } from '../hooks/useFeedReader';
import { useReviewActionsLayout } from '../hooks/useReviewActionsLayout';
import { useReviewShortcuts } from '../hooks/useReviewShortcuts';
import { getReaderMode } from '../state/readerMode';
import { getRequestErrorMessage } from '../services/authError';

export function ReaderPage() {
  const { t } = useTranslation();
  const { search } = useLocation();
  const mode = getReaderMode(search);
  const {
    items,
    currentItem,
    isLoading,
    isDeleting,
    loadFailed,
    loadError,
    deleteFailed,
    remainingCount,
    keepItem,
    deleteItem,
    resetReview,
    retryLoad,
  } = useFeedReader();
  const {
    panelRef: reviewPanelRef,
    actionsRef: reviewActionsRef,
    useCompactActions,
  } = useReviewActionsLayout(mode, currentItem);
  useReviewShortcuts({
    mode,
    currentItem,
    isDeleting,
    onKeep: keepItem,
    onDelete: deleteItem,
  });
  const hasLoadedContent = !isLoading && !loadFailed;

  return (
    <>
      <div className="reader__fullscreen-toolbar">
        <ReaderFullscreenButton />
      </div>
      <section className="reader" aria-labelledby="reader-page-title">
        <h1 id="reader-page-title" className="sr-only">{t('pages.reader')}</h1>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {mode === 'review' && currentItem
            ? t('reader.currentItemAnnouncement', {
              title: currentItem.title || currentItem.text,
              count: remainingCount,
            })
            : ''}
        </p>
        {isLoading ? <ReaderLoading /> : null}
        {loadFailed ? (
          <div className="reader__state" role="alert">
            <p>{getRequestErrorMessage(loadError, t, 'reader.loadError')}</p>
            <button type="button" className="secondary" onClick={retryLoad}>{t('live.tryAgain')}</button>
          </div>
        ) : null}
        {hasLoadedContent && items.length === 0 ? (
          <div className="reader__state">
            <span className="reader__done-mark" aria-hidden="true">✓</span>
            <h2>{t('reader.caughtUp')}</h2>
            <p>{t('reader.noMore')}</p>
            <button type="button" className="secondary" onClick={retryLoad}>{t('reader.checkAgain')}</button>
          </div>
        ) : null}
        {mode === 'review' && currentItem ? (
          <ReaderReview
            key={currentItem.id}
            item={currentItem}
            remainingCount={remainingCount}
            isDeleting={isDeleting}
            deleteFailed={deleteFailed}
            useCompactActions={useCompactActions}
            reviewPanelRef={reviewPanelRef}
            reviewActionsRef={reviewActionsRef}
            onKeep={keepItem}
            onDelete={deleteItem}
            onReset={resetReview}
          />
        ) : null}
        {mode === 'review' && hasLoadedContent && items.length > 0 && !currentItem ? (
          <div id="reader-review-panel" className="reader__state" role="region" aria-label="Review view">
            <span className="reader__done-mark" aria-hidden="true">✓</span>
            <h2>{t('reader.reviewedEverything')}</h2>
            <p>{t('reader.switchToScroll')}</p>
            <div className="reader__state-actions">
              <button type="button" className="reader__reset" aria-label={t('reader.resetKeptItems')} onClick={resetReview}>
                {t('reader.reset')}
              </button>
            </div>
          </div>
        ) : null}
        {mode === 'scroll' && hasLoadedContent && items.length > 0 ? <ReaderScroll items={items} /> : null}
      </section>
    </>
  );
}

function ReaderLoading() {
  const { t } = useTranslation();

  return (
    <div className="reader__loading" role="status" aria-label={t('reader.loading')}>
      <div className="reader__loading-line reader__loading-line--short" />
      <div className="reader__loading-line reader__loading-line--title" />
      <div className="reader__loading-line" />
      <div className="reader__loading-line" />
    </div>
  );
}

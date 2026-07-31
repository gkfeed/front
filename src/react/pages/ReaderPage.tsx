import { useLocation, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';

import { ReaderReview } from '../components/ReaderReview';
import { ReaderScroll } from '../components/ReaderScroll';
import { useFeedReader } from '../hooks/useFeedReader';
import { useReviewActionsLayout } from '../hooks/useReviewActionsLayout';
import { useReviewShortcuts } from '../hooks/useReviewShortcuts';
import { getReaderMode, type ReaderMode } from '../state/readerMode';

export function ReaderPage() {
  const { t } = useTranslation();
  const { search } = useLocation();
  const [, setSearchParams] = useSearchParams();
  const mode = getReaderMode(search);
  const {
    items,
    currentItem,
    isLoading,
    isDeleting,
    loadFailed,
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

  function setMode(nextMode: ReaderMode) {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      if (nextMode === 'review') nextParams.delete('view');
      else nextParams.set('view', nextMode);
      return nextParams;
    });
  }

  return (
    <section className="reader" aria-labelledby="reader-page-title">
      <h1 id="reader-page-title" className="sr-only">{t('pages.reader')}</h1>
      {isLoading ? <ReaderLoading /> : null}
      {loadFailed ? (
        <div className="reader__state" role="alert">
          <p>{t('reader.loadError')}</p>
          <button type="button" className="secondary" onClick={retryLoad}>{t('live.tryAgain')}</button>
        </div>
      ) : null}
      {!isLoading && !loadFailed && items.length === 0 ? (
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
          onShowScroll={() => setMode('scroll')}
        />
      ) : null}
      {mode === 'review' && !isLoading && !loadFailed && items.length > 0 && !currentItem ? (
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
      {mode === 'scroll' && !isLoading && !loadFailed && items.length > 0 ? <ReaderScroll items={items} /> : null}
    </section>
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

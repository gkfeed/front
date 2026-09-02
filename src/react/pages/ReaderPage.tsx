import { useTranslation } from 'react-i18next';

import '../../styles/reader.css';
import { ReaderReview } from '../components/ReaderReview';
import { ReaderScroll } from '../components/ReaderScroll';
import { ReaderFullscreenButton } from '../components/ReaderFullscreenButton';
import {
  useReaderPageModel,
  type FeedItemDeletion,
} from '../adapters/reader/useReaderPageModel';

export function ReaderPage() {
  const { t } = useTranslation();
  const {
    items,
    currentItem,
    isLoading,
    isItemPending,
    loadFailed,
    failedDeletions,
    remainingCount,
    keepItem,
    deleteItem,
    recoverDeletion,
    resetReview,
    retryLoad,
    mode,
    itemOrder,
    reviewPanelRef,
    hasLoadedContent,
    loadErrorMessage,
  } = useReaderPageModel(t);

  return (
    <>
      <div className="reader__fullscreen-toolbar">
        <ReaderFullscreenButton enableKeyboardShortcut />
      </div>
      <section className="reader" aria-labelledby="reader-page-title">
        <h1 id="reader-page-title" className="sr-only">{t('pages.reader')}</h1>
        <ReaderDeletionErrors deletions={failedDeletions} onRecover={recoverDeletion} />
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
            <p>{loadErrorMessage}</p>
            <button type="button" className="ui-button--secondary" onClick={retryLoad}>{t('live.tryAgain')}</button>
          </div>
        ) : null}
        {hasLoadedContent && items.length === 0 ? (
          <div className="reader__state">
            <span className="reader__done-mark" aria-hidden="true">✓</span>
            <h2>{t('reader.caughtUp')}</h2>
            <p>{t('reader.noMore')}</p>
            <button type="button" className="ui-button--secondary" onClick={retryLoad}>{t('reader.checkAgain')}</button>
          </div>
        ) : null}
        {mode === 'review' && currentItem ? (
          <ReaderReview
            key={currentItem.id}
            item={currentItem}
            remainingCount={remainingCount}
            isDeleting={isItemPending(currentItem.id)}
            reviewPanelRef={reviewPanelRef}
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
              <button type="button" className="ui-button--secondary" onClick={retryLoad}>
                {t('reader.checkAgain')}
              </button>
            </div>
          </div>
        ) : null}
        {mode === 'scroll' && hasLoadedContent && items.length > 0 ? (
          <ReaderScroll key={itemOrder} items={items} />
        ) : null}
      </section>
    </>
  );
}

function ReaderDeletionErrors({
  deletions,
  onRecover,
}: {
  deletions: FeedItemDeletion[];
  onRecover: (itemId: number) => void;
}) {
  const { t } = useTranslation();
  if (deletions.length === 0) return null;

  return (
    <div className="reader__deletion-errors" aria-label={t('reader.deletionErrors')}>
      {deletions.map((deletion) => (
        <div role="alert" key={deletion.itemId}>
          <button
            type="button"
            className="reader__deletion-error"
            onClick={() => onRecover(deletion.itemId)}
          >
            <span>{t('reader.deleteError', { title: deletion.title || t('feed.item') })}</span>
            <span className="ui-button--secondary">{t('reader.recoverDeletedItem')}</span>
          </button>
        </div>
      ))}
    </div>
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

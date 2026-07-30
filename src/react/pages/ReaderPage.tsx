import { useLocation, useSearchParams } from 'react-router';

import { ReaderReview } from '../components/ReaderReview';
import { ReaderScroll } from '../components/ReaderScroll';
import { useFeedReader } from '../hooks/useFeedReader';
import { useReviewActionsLayout } from '../hooks/useReviewActionsLayout';
import { useReviewShortcuts } from '../hooks/useReviewShortcuts';
import { getReaderMode, type ReaderMode } from '../state/readerMode';

export function ReaderPage() {
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
      <h1 id="reader-page-title" className="sr-only">Reader</h1>
      {isLoading ? <ReaderLoading /> : null}
      {loadFailed ? (
        <div className="reader__state" role="alert">
          <p>Could not load your feed items.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Try again</button>
        </div>
      ) : null}
      {!isLoading && !loadFailed && items.length === 0 ? (
        <div className="reader__state">
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’re all caught up</h2>
          <p>There are no more items in this reading session.</p>
          <button type="button" className="secondary" onClick={retryLoad}>Check again</button>
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
          onShowScroll={() => setMode('scroll')}
        />
      ) : null}
      {mode === 'review' && !isLoading && !loadFailed && items.length > 0 && !currentItem ? (
        <div id="reader-review-panel" className="reader__state" role="region" aria-label="Review view">
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’ve reviewed everything</h2>
          <p>Switch to Scroll to browse all items again.</p>
        </div>
      ) : null}
      {mode === 'scroll' && !isLoading && !loadFailed && items.length > 0 ? <ReaderScroll items={items} /> : null}
    </section>
  );
}

function ReaderLoading() {
  return (
    <div className="reader__loading" role="status" aria-label="Loading feed items">
      <div className="reader__loading-line reader__loading-line--short" />
      <div className="reader__loading-line reader__loading-line--title" />
      <div className="reader__loading-line" />
      <div className="reader__loading-line" />
    </div>
  );
}

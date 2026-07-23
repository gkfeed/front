import { useEffect, useState } from 'react';

import { FeedItemCard } from '../components/FeedItemCard';
import { useFeedReader } from '../hooks/useFeedReader';

type ReaderMode = 'review' | 'scroll';

export function ReaderPage() {
  const [mode, setMode] = useState<ReaderMode>('review');
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        mode !== 'review'
        || !currentItem
        || isDeleting
        || event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.shiftKey
        || isTextEntryTarget(event.target)
        || (event.target instanceof Element && event.target.closest('[role="tab"]'))
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        keepItem();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        void deleteItem();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItem, deleteItem, isDeleting, keepItem, mode]);

  return (
    <section className="reader" aria-labelledby="reader-page-title">
      <h1 id="reader-page-title" className="sr-only">Reader</h1>

      <div className="reader__tabs" role="tablist" aria-label="Reader view">
        <ReaderModeTab mode="review" currentMode={mode} onSelect={setMode}>Review</ReaderModeTab>
        <ReaderModeTab mode="scroll" currentMode={mode} onSelect={setMode}>Scroll</ReaderModeTab>
      </div>

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
        <div
          id="reader-review-panel"
          className="reader__item"
          role="tabpanel"
          aria-labelledby="reader-review-tab"
        >
          <FeedItemCard key={currentItem.id} item={currentItem} />
          <div className="reader__actions" aria-label="Feed item actions">
            <button type="button" className="reader__keep" onClick={keepItem} disabled={isDeleting}>
              <span aria-hidden="true">✓</span> Keep
            </button>
            <button type="button" className="delete" onClick={deleteItem} disabled={isDeleting}>
              <span aria-hidden="true">×</span> {isDeleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
          {deleteFailed ? (
            <p className="status status--error reader__error" role="alert">
              Could not delete this item. It is still in your feed; try again.
            </p>
          ) : null}
          <div className="reader__count-row">
            <span className="reader__count">{remainingCount} remaining</span>
          </div>
        </div>
      ) : null}

      {mode === 'review' && !isLoading && !loadFailed && items.length > 0 && !currentItem ? (
        <div
          id="reader-review-panel"
          className="reader__state"
          role="tabpanel"
          aria-labelledby="reader-review-tab"
        >
          <span className="reader__done-mark" aria-hidden="true">✓</span>
          <h2>You’ve reviewed everything</h2>
          <p>Switch to Scroll to browse all items again.</p>
        </div>
      ) : null}

      {mode === 'scroll' && !isLoading && !loadFailed && items.length > 0 ? (
        <div
          id="reader-scroll-panel"
          className="reader__scroll-panel"
          role="tabpanel"
          aria-labelledby="reader-scroll-tab"
        >
          <div className="reader__stream">
            {items.map((item) => <FeedItemCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function isTextEntryTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
  );
}

type ReaderModeTabProps = {
  children: string;
  mode: ReaderMode;
  currentMode: ReaderMode;
  onSelect: (mode: ReaderMode) => void;
};

function ReaderModeTab({ children, mode, currentMode, onSelect }: ReaderModeTabProps) {
  const selected = mode === currentMode;

  return (
    <button
      id={`reader-${mode}-tab`}
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={`reader-${mode}-panel`}
      onClick={() => onSelect(mode)}
    >
      {children}
    </button>
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
